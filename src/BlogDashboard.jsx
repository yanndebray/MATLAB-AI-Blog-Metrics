import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Eye, TrendingUp, FileText, Calendar, ExternalLink, RefreshCw } from 'lucide-react';
import postsData from '../posts.json';

// Process posts to ensure viewsHistory exists
const blogData = {
  lastUpdated: postsData.lastUpdated,
  posts: postsData.posts.map(post => ({
    ...post,
    viewsHistory: post.viewsHistory || [{ date: post.date, views: post.views }]
  }))
};

// MathWorks brand colors
const COLORS = {
  primary: '#0076A8',      // MathWorks Blue
  secondary: '#E87722',    // MathWorks Orange  
  accent1: '#7A8B8B',      // Gray
  accent2: '#4CAF50',      // Green
  accent3: '#9C27B0',      // Purple
  background: '#F8FAFC',
  cardBg: '#FFFFFF',
  text: '#1E293B',
  textLight: '#64748B',
  border: '#E2E8F0',
  gradient: ['#0076A8', '#00A3E0', '#4FC3F7'],
};

const categoryColors = {
  'Agentic AI': '#0076A8',
  'Generative AI': '#E87722',
  'Machine Learning': '#4CAF50',
  'MATLAB with Python': '#9C27B0',
  'Cloud AI': '#00BCD4',
  'MATLAB Online': '#FF5722',
  'PyTorch': '#EE4C2C',
  'TensorFlow': '#FF6F00',
  'AI Application': '#3F51B5',
  'Conference': '#795548',
  'Agentic App Building': '#00ACC1',
};

function StatCard({ icon: Icon, label, value, subtext, color }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 mb-1">{label}</p>
          <p className="text-3xl font-bold text-slate-800">{value}</p>
          {subtext && <p className="text-sm text-slate-400 mt-1">{subtext}</p>}
        </div>
        <div className={`p-3 rounded-lg`} style={{ backgroundColor: `${color}15` }}>
          <Icon size={24} style={{ color }} />
        </div>
      </div>
    </div>
  );
}

function PostRow({ post, rank }) {
  const daysSincePublish = Math.floor((new Date() - new Date(post.date)) / (1000 * 60 * 60 * 24));
  const viewsPerDay = daysSincePublish > 0 ? Math.round(post.views / daysSincePublish) : post.views;
  
  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-4">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-semibold text-sm">
          {rank}
        </span>
      </td>
      <td className="px-4 py-4">
        <div>
          <a 
            href={post.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-slate-800 font-medium hover:text-blue-600 transition-colors flex items-center gap-1"
          >
            {post.title}
            <ExternalLink size={14} className="text-slate-400" />
          </a>
          <div className="flex flex-wrap gap-1 mt-2">
            {post.categories.map(cat => (
              <span 
                key={cat}
                className="px-2 py-0.5 text-xs rounded-full text-white"
                style={{ backgroundColor: categoryColors[cat] || '#64748B' }}
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-slate-600">
        {new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </td>
      <td className="px-4 py-4">
        <span className="font-semibold text-slate-800">{post.views.toLocaleString()}</span>
      </td>
      <td className="px-4 py-4 text-slate-600">
        {viewsPerDay}/day
      </td>
      <td className="px-4 py-4">
        <div className="w-32 h-8">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={post.viewsHistory}>
              <defs>
                <linearGradient id={`gradient-${post.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0076A8" stopOpacity={0.4}/>
                  <stop offset="100%" stopColor="#0076A8" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <Area 
                type="monotone" 
                dataKey="views" 
                stroke="#0076A8" 
                strokeWidth={1.5}
                fill={`url(#gradient-${post.id})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </td>
    </tr>
  );
}

export default function BlogDashboard() {
  const [selectedPost, setSelectedPost] = useState(null);
  
  const stats = useMemo(() => {
    const totalViews = blogData.posts.reduce((sum, p) => sum + p.views, 0);
    const avgViews = Math.round(totalViews / blogData.posts.length);
    const sortedByViews = [...blogData.posts].sort((a, b) => b.views - a.views);
    const topPost = sortedByViews[0];
    
    // Calculate week-over-week growth
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    let currentWeekViews = 0;
    let previousWeekViews = 0;
    
    blogData.posts.forEach(post => {
      const history = post.viewsHistory;
      if (history.length >= 2) {
        currentWeekViews += history[history.length - 1].views;
        previousWeekViews += history[Math.max(0, history.length - 2)].views;
      }
    });
    
    const weekGrowth = previousWeekViews > 0 
      ? Math.round(((currentWeekViews - previousWeekViews) / previousWeekViews) * 100) 
      : 0;
    
    return { totalViews, avgViews, topPost, weekGrowth, postCount: blogData.posts.length };
  }, []);

  // Prepare data for bar chart
  const barChartData = [...blogData.posts]
    .sort((a, b) => b.views - a.views)
    .map(p => ({
      name: p.title.length > 30 ? p.title.substring(0, 30) + '...' : p.title,
      fullTitle: p.title,
      views: p.views,
      date: p.date,
    }));

  // Prepare cumulative views over time
  const cumulativeData = useMemo(() => {
    const allDates = new Set();
    blogData.posts.forEach(post => {
      post.viewsHistory.forEach(h => allDates.add(h.date));
    });
    
    const sortedDates = Array.from(allDates).sort();
    
    return sortedDates.map(date => {
      const dataPoint = { date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
      let total = 0;
      
      blogData.posts.forEach(post => {
        const historyPoint = post.viewsHistory.find(h => h.date === date);
        if (historyPoint) {
          total += historyPoint.views;
        } else {
          // Find the most recent data point before this date
          const prevPoints = post.viewsHistory.filter(h => h.date < date);
          if (prevPoints.length > 0) {
            total += prevPoints[prevPoints.length - 1].views;
          }
        }
      });
      
      dataPoint.totalViews = total;
      return dataPoint;
    });
  }, []);

  // Category distribution
  const categoryData = useMemo(() => {
    const cats = {};
    blogData.posts.forEach(post => {
      post.categories.forEach(cat => {
        cats[cat] = (cats[cat] || 0) + post.views;
      });
    });
    return Object.entries(cats)
      .map(([name, views]) => ({ name, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 8);
  }, []);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-slate-200">
          <p className="text-sm font-medium text-slate-800">{payload[0].payload.fullTitle || label}</p>
          <p className="text-lg font-bold text-blue-600">{payload[0].value.toLocaleString()} views</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <FileText size={20} className="text-white" />
              </div>
              MATLAB AI Blog Analytics
            </h1>
            <p className="text-slate-500 mt-2">
              Posts by Yann Debray since September 1, 2025
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200">
            <RefreshCw size={14} />
            Last updated: {new Date(blogData.lastUpdated).toLocaleDateString('en-US', { 
              month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' 
            })}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard 
          icon={Eye} 
          label="Total Views" 
          value={stats.totalViews.toLocaleString()} 
          subtext="All posts combined"
          color={COLORS.primary}
        />
        <StatCard 
          icon={FileText} 
          label="Total Posts" 
          value={stats.postCount} 
          subtext="Since Sep 1, 2025"
          color={COLORS.secondary}
        />
        <StatCard 
          icon={TrendingUp} 
          label="Avg. Views/Post" 
          value={stats.avgViews.toLocaleString()} 
          subtext={`Top: ${stats.topPost.views.toLocaleString()}`}
          color={COLORS.accent2}
        />
        <StatCard 
          icon={Calendar} 
          label="Week Growth" 
          value={`+${stats.weekGrowth}%`} 
          subtext="Views vs last week"
          color={COLORS.accent3}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Cumulative Views */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Cumulative Views Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={cumulativeData}>
              <defs>
                <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0076A8" stopOpacity={0.3}/>
                  <stop offset="100%" stopColor="#0076A8" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12, fill: '#64748B' }}
                tickLine={{ stroke: '#E2E8F0' }}
              />
              <YAxis 
                tick={{ fontSize: 12, fill: '#64748B' }}
                tickLine={{ stroke: '#E2E8F0' }}
                tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="totalViews" 
                stroke="#0076A8" 
                strokeWidth={2}
                fill="url(#viewsGradient)"
                name="Total Views"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Views by Category */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Views by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={categoryData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis 
                type="number"
                tick={{ fontSize: 12, fill: '#64748B' }}
                tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
              />
              <YAxis 
                type="category"
                dataKey="name" 
                tick={{ fontSize: 11, fill: '#64748B' }}
                width={120}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="views" 
                fill="#0076A8" 
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Views by Post Bar Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Views by Post</h3>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={barChartData}>
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0076A8" stopOpacity={1}/>
                <stop offset="100%" stopColor="#00A3E0" stopOpacity={0.8}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 10, fill: '#64748B' }}
              tickLine={{ stroke: '#E2E8F0' }}
              angle={-45}
              textAnchor="end"
              height={100}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: '#64748B' }}
              tickLine={{ stroke: '#E2E8F0' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="views" 
              fill="url(#barGradient)" 
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Posts Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">All Posts</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Rank</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Post</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Views</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Velocity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {[...blogData.posts]
                .sort((a, b) => b.views - a.views)
                .map((post, idx) => (
                  <PostRow key={post.id} post={post} rank={idx + 1} />
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-sm text-slate-400">
        <p>Dashboard auto-updates daily via GitHub Actions</p>
        <p className="mt-1">
          Data source: <a href="https://blogs.mathworks.com/deep-learning/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">MATLAB AI Blog</a>
        </p>
      </div>
    </div>
  );
}
