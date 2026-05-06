/**
 * pages/TrendsPage.jsx
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TrendingUp, ArrowUp, ArrowDown, Minus, Sparkles, Plus, FolderKanban } from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import {
  Card, CardHeader, CardBody, Badge, Button,
  AIResultBox, PageLoader, SectionTitle, Input, Textarea, Modal, Select, ProgressBar, EmptyState
} from '../components/Shared/UI';
import { aiAPI, papersAPI, projectsAPI } from '../api/client';
import { useAuthStore } from '../store';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

// ══════════════════════════════════════════════════════════════════════════
export function TrendsPage() {
  const [domain, setDomain] = useState('artificial intelligence');
  const [query, setQuery]   = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['trends', domain],
    queryFn: () => aiAPI.analyzeTrends({ domain }).then(r => r.data),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const momIcon = (m) => m === 'rising' ? <ArrowUp size={12} className="text-green-500" />
                        : m === 'declining' ? <ArrowDown size={12} className="text-red-500" />
                        : <Minus size={12} className="text-slate-400" />;

  const chartData = data?.hot_topics?.slice(0,8).map(t => ({
    topic: t.topic?.split(' ').slice(0,2).join(' '),
    score: Math.round((t.trend_score || 0) * 100),
  })) || [];

  const DOMAINS = ['artificial intelligence','natural language processing','machine learning',
    'computer vision','quantum computing','bioinformatics','distributed systems','cybersecurity'];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <SectionTitle subtitle="AI-powered research trend analysis across academic domains">
        Research Trends
      </SectionTitle>

      <div className="flex gap-3 flex-wrap items-center">
        <select value={domain} onChange={e => setDomain(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
          {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <Button onClick={() => refetch()} icon={Sparkles} variant="secondary">
          Refresh Analysis
        </Button>
      </div>

      {isLoading && <PageLoader />}

      {isError && !isLoading && (
        <Card>
          <CardBody>
            <EmptyState
              icon={TrendingUp}
              title="Trend analysis is unavailable"
              description={error?.response?.data?.detail || 'The AI trend endpoint could not return data right now.'}
              action={
                <Button onClick={() => refetch()} icon={Sparkles} variant="secondary">
                  Try Again
                </Button>
              }
            />
          </CardBody>
        </Card>
      )}

      {data && !isLoading && (
        <>
          {data.source === 'local_fallback_no_anthropic_key' && (
            <AIResultBox title="Development Trend Preview">
              <p className="text-sm text-slate-700 leading-relaxed">
                Showing built-in sample trend data because ANTHROPIC_API_KEY is not configured.
              </p>
            </AIResultBox>
          )}

          {/* Chart */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader><h3 className="font-semibold text-slate-800">Hot Topics by Trend Score</h3></CardHeader>
              <CardBody>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ left: -20, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="topic" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="score" fill="#6366f1" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
          )}

          {/* Hot topics grid */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">🔥 Hot Topics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.hot_topics?.slice(0,9).map((t, i) => (
                <Card key={i} className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-sm text-slate-800">{t.topic}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      {momIcon(t.momentum)}
                      <span className="text-xs font-bold text-slate-600">
                        {Math.round((t.trend_score || 0) * 100)}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{t.description}</p>
                  {t.why_hot && <p className="text-xs text-indigo-600 mt-1">💡 {t.why_hot}</p>}
                </Card>
              ))}
            </div>
          </div>

          {/* Emerging areas + gaps */}
          <div className="grid md:grid-cols-2 gap-5">
            <Card>
              <CardHeader><h3 className="font-semibold text-slate-800">🌱 Emerging Areas</h3></CardHeader>
              <CardBody className="space-y-2">
                {data.emerging_areas?.map((a, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Badge color={a.opportunity_level === 'high' ? 'green' : 'yellow'}>{a.opportunity_level}</Badge>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{a.area}</p>
                      <p className="text-xs text-slate-500">{a.description}</p>
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>

            <Card>
              <CardHeader><h3 className="font-semibold text-slate-800">🔍 Research Gaps</h3></CardHeader>
              <CardBody>
                <ul className="space-y-1.5">
                  {data.research_gaps?.map((g, i) => (
                    <li key={i} className="text-sm text-slate-600 flex gap-2">
                      <span className="text-amber-400 shrink-0">▸</span>{g}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </div>

          {data.overall_field_direction && (
            <AIResultBox title="Field Direction Summary">
              <p className="text-sm text-slate-700 leading-relaxed">{data.overall_field_direction}</p>
            </AIResultBox>
          )}

          {!data.hot_topics?.length && !data.emerging_areas?.length && !data.research_gaps?.length && (
            <Card>
              <CardBody>
                <EmptyState
                  icon={TrendingUp}
                  title="No trend results yet"
                  description="Refresh the analysis or choose another research domain."
                />
              </CardBody>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
export default TrendsPage;
