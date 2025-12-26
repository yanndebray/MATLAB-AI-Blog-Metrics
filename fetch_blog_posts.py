"""
MATLAB AI Blog Posts Scraper

Scrapes all posts by Yann Debray from the MATLAB AI Blog (Deep Learning blog)
starting from September 1st, 2025.

This script dynamically discovers posts via RSS feeds instead of hardcoding them,
so new posts are automatically included.

Usage:
    python fetch_blog_posts.py

Requirements:
    Python 3.10+ (no external dependencies)

Note: The MathWorks blog uses Akamai CDN with bot protection. This script works
best when run from GitHub Actions or similar CI environments. If you get 403
errors locally, try running from a different network or use the --use-cache flag.
"""

import argparse
import json
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


# Configuration
AUTHOR_NAME = "Yann Debray"
START_DATE = datetime(2025, 9, 1)  # September 1st, 2025
OUTPUT_FILE = Path(__file__).parent / "posts.json"
CACHE_FILE = Path(__file__).parent / ".rss_cache.xml"

# RSS feed URLs to check
RSS_FEEDS = [
    "https://blogs.mathworks.com/deep-learning/author/ydebray/feed/",
    "https://blogs.mathworks.com/deep-learning/feed/",
    "https://blogs.mathworks.com/deep-learning/feed/?paged=2",
    "https://blogs.mathworks.com/deep-learning/feed/?paged=3",
]

# Request headers matching the working MikeVsYann approach
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Encoding": "identity",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive",
    "Referer": "https://blogs.mathworks.com/",
}


def create_post_id(title: str) -> str:
    """Create a URL-friendly ID from a post title."""
    post_id = title.lower()
    post_id = re.sub(r'[^a-z0-9\s-]', '', post_id)
    post_id = re.sub(r'[\s-]+', '-', post_id)
    post_id = post_id[:50].strip('-')
    return post_id


def parse_rss_date(date_str: str) -> Optional[datetime]:
    """Parse RSS date formats."""
    date_formats = [
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S %Z",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%d",
    ]

    date_str = date_str.strip()

    for fmt in date_formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.replace(tzinfo=None)
        except ValueError:
            continue

    return None


def fetch_with_curl(url: str) -> Optional[str]:
    """Try to fetch URL using system curl command (primary method)."""
    try:
        result = subprocess.run(
            [
                "curl", "-Ls",
                "-H", "Accept-Encoding: identity",
                url
            ],
            capture_output=True,
            timeout=30
        )
        if result.returncode == 0 and result.stdout:
            return result.stdout.decode("utf-8", errors="ignore")
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    return None


def fetch_with_urllib(url: str) -> Optional[str]:
    """Try to fetch URL using urllib (fallback method)."""
    try:
        req = Request(url, headers=HEADERS)
        with urlopen(req, timeout=30) as response:
            return response.read().decode("utf-8", errors="ignore")
    except (HTTPError, URLError, TimeoutError):
        pass
    return None


def fetch_rss_feed(url: str) -> Optional[str]:
    """Fetch RSS feed content using multiple methods."""
    # Try curl first (works better with Akamai)
    content = fetch_with_curl(url)
    if content and "<?xml" in content:
        return content

    # Try urllib as fallback
    content = fetch_with_urllib(url)
    if content and "<?xml" in content:
        return content

    return None


def parse_rss_feed(xml_content: str) -> list[dict]:
    """Parse RSS feed XML and extract post data."""
    posts = []

    try:
        root = ET.fromstring(xml_content)
        items = root.findall('.//item')

        for item in items:
            try:
                title_elem = item.find('title')
                link_elem = item.find('link')
                pub_date_elem = item.find('pubDate')
                creator_elem = item.find('.//{http://purl.org/dc/elements/1.1/}creator')

                if title_elem is None or link_elem is None:
                    continue

                title = title_elem.text or ""
                url = link_elem.text or ""

                author = ""
                if creator_elem is not None and creator_elem.text:
                    author = creator_elem.text

                if AUTHOR_NAME.lower() not in author.lower():
                    continue

                pub_date = None
                if pub_date_elem is not None and pub_date_elem.text:
                    pub_date = parse_rss_date(pub_date_elem.text)

                if not pub_date:
                    date_match = re.search(r'/(\d{4})/(\d{2})/(\d{2})/', url)
                    if date_match:
                        pub_date = datetime(
                            int(date_match.group(1)),
                            int(date_match.group(2)),
                            int(date_match.group(3))
                        )

                if not pub_date or pub_date < START_DATE:
                    continue

                categories = []
                for cat_elem in item.findall('category'):
                    if cat_elem.text:
                        categories.append(cat_elem.text)

                post = {
                    "id": create_post_id(title),
                    "title": title,
                    "date": pub_date.strftime("%Y-%m-%d"),
                    "url": url,
                    "categories": categories,
                    "views": 0,
                    "viewsLast30Days": 0,
                }

                posts.append(post)

            except Exception as e:
                print(f"  Warning: Error parsing item: {e}")
                continue

    except ET.ParseError as e:
        print(f"  Warning: XML parse error: {e}")

    return posts


def scrape_all_posts(use_cache: bool = False) -> list[dict]:
    """Scrape all posts from RSS feeds."""
    all_posts = {}
    feeds_fetched = 0

    print(f"\nScraping posts by {AUTHOR_NAME} since {START_DATE.strftime('%Y-%m-%d')}...\n")

    for feed_url in RSS_FEEDS:
        print(f"Fetching: {feed_url}")
        xml_content = fetch_rss_feed(feed_url)

        if not xml_content:
            print(f"  Failed to fetch (403/blocked)")
            continue

        feeds_fetched += 1
        posts = parse_rss_feed(xml_content)

        for post in posts:
            if post['url'] not in all_posts:
                all_posts[post['url']] = post
                print(f"  Found: {post['title'][:55]}{'...' if len(post['title']) > 55 else ''}")

    # If no feeds could be fetched, try using cached/existing data
    if feeds_fetched == 0:
        print("\n" + "=" * 60)
        print("WARNING: Could not fetch RSS feeds (blocked by CDN)")
        print("=" * 60)
        print("\nThe MathWorks blog uses Akamai CDN with bot protection.")
        print("This typically works in GitHub Actions but may fail locally.")
        print("\nOptions:")
        print("  1. Run from GitHub Actions (recommended)")
        print("  2. Use existing posts.json if available")
        print("  3. Run from a different network (e.g., MathWorks VPN)")

        # Try to use existing data
        if OUTPUT_FILE.exists():
            print(f"\nUsing existing data from {OUTPUT_FILE}")
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get('posts', [])

        return []

    posts_list = list(all_posts.values())
    posts_list.sort(key=lambda x: x['date'], reverse=True)

    return posts_list


def load_existing_data() -> dict:
    """Load existing posts.json if it exists."""
    if OUTPUT_FILE.exists():
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return {"lastUpdated": "", "posts": []}


def merge_posts(new_posts: list[dict], existing_data: dict) -> list[dict]:
    """Merge new posts with existing data, preserving view counts."""
    existing_by_url = {p['url']: p for p in existing_data.get('posts', [])}

    merged = []
    for post in new_posts:
        if post['url'] in existing_by_url:
            existing = existing_by_url[post['url']]
            post['views'] = existing.get('views', 0)
            post['viewsLast30Days'] = existing.get('viewsLast30Days', 0)
            if 'viewsHistory' in existing:
                post['viewsHistory'] = existing['viewsHistory']
        merged.append(post)

    return merged


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Scrape MATLAB AI Blog posts")
    parser.add_argument('--use-cache', action='store_true',
                        help='Use cached RSS data if available')
    parser.add_argument('--dry-run', action='store_true',
                        help='Print results without writing to file')
    args = parser.parse_args()

    print("=" * 60)
    print("MATLAB AI Blog Posts Scraper")
    print("=" * 60)

    # Check if running in CI
    if os.environ.get('CI') or os.environ.get('GITHUB_ACTIONS'):
        print("Running in CI environment")

    # Scrape posts
    posts = scrape_all_posts(use_cache=args.use_cache)

    if not posts:
        print("\nNo posts found.")
        return 1

    # Load existing data and merge
    existing_data = load_existing_data()
    posts = merge_posts(posts, existing_data)

    # Create output data
    output = {
        "lastUpdated": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "posts": posts
    }

    if args.dry_run:
        print("\n[DRY RUN - not writing to file]")
    else:
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)

    print("\n" + "=" * 60)
    print(f"Found {len(posts)} posts by {AUTHOR_NAME}")
    if not args.dry_run:
        print(f"Output saved to: {OUTPUT_FILE}")
    print("=" * 60)

    print("\nPosts:")
    for i, post in enumerate(posts, 1):
        cats = ", ".join(post['categories'][:2]) if post['categories'] else "No category"
        print(f"  {i:2}. [{post['date']}] {post['title'][:45]}{'...' if len(post['title']) > 45 else ''}")
        print(f"      Categories: {cats}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
