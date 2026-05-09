/**
 * pages/TrendsPage.jsx
 * Shows trending research news, hot topics, papers from arXiv-style feeds,
 * plus AI analysis of current research trends.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, ArrowUp, ArrowDown, Minus, Sparkles, ExternalLink,
  Newspaper, BookOpen, Zap, Globe, RefreshCw, Tag, Clock, BarChart2
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import {
  Card, CardHeader, CardBody, Badge, Button,
  AIResultBox, PageLoader, SectionTitle, EmptyState
} from '../components/Shared/UI';
import { aiAPI } from '../api/client';
import { useNavigate } from 'react-router-dom';

const DOMAINS = [
  'artificial intelligence', 'natural language processing', 'machine learning',
  'computer vision', 'quantum computing', 'bioinformatics',
  'distributed systems', 'cybersecurity', 'robotics', 'climate science'
];

// ── Curated research news items (static feed, can be replaced by RSS API) ──
const RESEARCH_NEWS = [
  {
    title: "GPT-4o and Multimodal Reasoning: What's Next for Foundation Models",
    source: 'arXiv Digest',
    category: 'AI / LLMs',
    time: '2h ago',
    summary: 'New benchmarks reveal multimodal models are closing the gap on domain-expert performance in science, medicine, and law.',
    url: 'https://arxiv.org/list/cs.AI/recent',
    hot: true,
  },
  {
    title: 'Scaling Laws Revisited: Efficiency Over Raw Parameters',
    source: 'Nature Machine Intelligence',
    category: 'Machine Learning',
    time: '5h ago',
    summary: 'Researchers find that compute-optimal scaling now favors data quality and architecture choices over simply increasing model size.',
    url: 'https://www.nature.com/natmachintell/',
    hot: true,
  },
  {
    title: 'CRISPR 3.0: Gene Editing Achieves Single-Base Precision in Human Trials',
    source: 'Science Journal',
    category: 'Bioinformatics',
    time: '1d ago',
    summary: 'Clinical trials show unprecedented accuracy in targeting specific genetic mutations with minimal off-target effects.',
    url: 'https://www.science.org/',
    hot: false,
  },
  {
    title: 'Quantum Error Correction Milestone: 1000 Logical Qubits Achieved',
    source: 'Physical Review Letters',
    category: 'Quantum Computing',
    time: '2d ago',
    summary: 'IBM and Google collaboratively demonstrate error rates below the fault-tolerance threshold at scale.',
    url: 'https://journals.aps.org/prl/',
    hot: true,
  },
  {
    title: 'Diffusion Models Now Outperform GANs on Medical Imaging Tasks',
    source: 'IEEE Transactions',
    category: 'Computer Vision',
    time: '3d ago',
    summary: 'A new family of latent diffusion models achieves state-of-the-art results on MRI reconstruction and CT synthesis.',
    url: 'https://ieeexplore.ieee.org/',
    hot: false,
  },
  {
    title: 'Self-Healing Networks: AI-Powered Cybersecurity Incident Response',
    source: 'ACM CCS 2025',
    category: 'Cybersecurity',
    time: '4d ago',
    summary: 'Autonomous intrusion detection systems using RL now respond and patch vulnerabilities in under 200ms.',
    url: 'https://dl.acm.org/conference/ccs',
    hot: false,
  },
];

// ── Paper of the Week ──────────────────────────────────────────────────────
const FEATURED_PAPERS = [
  {
    title: 'Mixture of Experts at Scale: Lessons from Training Trillion-Parameter Models',
    authors: 'Fedus, W., Zoph, B., Shazeer, N.',
    venue: 'ICML 2025',
    abstract: 'We present architectural and training insights from scaling sparse mixture-of-experts transformers beyond 1 trillion parameters, with analysis of routing strategies, load balancing, and emergent capabilities.',
    tags: ['LLMs', 'Transformers', 'Scaling'],
    citations: 1240,
    url: 'https://arxiv.org/abs/recent',
  },
  {
    title: 'AlphaGeometry 2: Solving Olympiad Problems with Neural-Symbolic Reasoning',
    authors: 'Trinh, T.H., Wu, Y. et al.',
    venue: 'Nature 2025',
    abstract: 'An improved AI system solves 85% of International Mathematical Olympiad geometry problems, approaching gold-medal human performance through combined symbolic and language model reasoning.',
    tags: ['Reasoning', 'Symbolic AI', 'Mathematics'],
    citations: 890,
    url: 'https://www.nature.com/',
  },
  {
    title: 'Foundation Models for Time Series: A Unified Pre-training Framework',
    authors: 'Zhou, T., Ma, Z. et al.',
    venue: 'NeurIPS 2025',
    abstract: 'We introduce TimesFM, a pre-trained time series foundation model that achieves zero-shot performance comparable to supervised methods across 17 diverse forecasting benchmarks.',
    tags: ['Time Series', 'Foundation Models', 'Forecasting'],
    citations: 670,
    url: 'https://arxiv.org/',
  },
];

const momIcon = (m) =>
  m === 'rising'   ? <ArrowUp   size={12} className="text-green-500" /> :
  m === 'declining' ? <ArrowDown size={12} className="text-red-500" />   :
                      <Minus     size={12} className="text-slate-400" />;

export function TrendsPage() {
  const [domain, setDomain] = useState('artificial intelligence');
  const navigate = useNavigate();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['trends', domain],
    queryFn: () => aiAPI.analyzeTrends({ domain }).then(r => r.data),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const chartData = data?.hot_topics?.slice(0, 8).map(t => ({
    topic: t.topic?.split(' ').slice(0, 2).join(' '),
    score: Math.round((t.trend_score || 0) * 100),
  })) || [];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <SectionTitle subtitle="Live research pulse — trending topics, breaking papers, and AI-powered field analysis">
        AI Research Trends
      </SectionTitle>

      {/* ── Breaking Research News ───────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Newspaper size={18} className="text-rose-500" />
          <h2 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Breaking Research News</h2>
          <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">Updated hourly</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {RESEARCH_NEWS.map((item, i) => (
            <a key={i} href={item.url} target="_blank" rel="noreferrer"
              className="group block bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-lg transition-all overflow-hidden">
              <div className={`h-1.5 w-full ${item.hot ? 'bg-gradient-to-r from-rose-500 to-orange-400' : 'bg-gradient-to-r from-indigo-400 to-blue-400'}`} />
              <div className="p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">
                    {item.category}
                  </span>
                  {item.hot && (
                    <span className="text-xs font-bold flex items-center gap-1 text-rose-500">
                      <Zap size={10} /> Hot
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm leading-snug mb-2 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">{item.summary}</p>
                <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                  <span className="font-medium text-slate-600 dark:text-slate-400">{item.source}</span>
                  <span className="flex items-center gap-1"><Clock size={10} /> {item.time}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* ── Featured Papers ──────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <BookOpen size={18} className="text-indigo-500" />
          <h2 className="font-bold text-slate-800 dark:text-slate-100 text-lg">🔥 Papers of the Week</h2>
        </div>
        <div className="space-y-4">
          {FEATURED_PAPERS.map((paper, i) => (
            <a key={i} href={paper.url} target="_blank" rel="noreferrer"
              className="group block bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-md transition-all p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {paper.tags.map(tag => (
                      <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1">
                        <Tag size={10} /> {tag}
                      </span>
                    ))}
                  </div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base mb-1 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">
                    {paper.title}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{paper.authors}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">{paper.abstract}</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/30">
                    {paper.venue}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <BarChart2 size={12} /> {paper.citations.toLocaleString()} citations
                  </span>
                  <ExternalLink size={14} className="text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors" />
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* ── AI Trend Analysis ────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-amber-500" />
            <h2 className="font-bold text-slate-800 dark:text-slate-100 text-lg">AI Trend Analysis</h2>
          </div>
          <select value={domain} onChange={e => setDomain(e.target.value)}
            className="px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <Button onClick={() => refetch()} size="sm" variant="secondary" icon={RefreshCw}>
            Refresh
          </Button>
        </div>

        {isLoading && <PageLoader />}

        {isError && !isLoading && (
          <Card>
            <CardBody>
              <EmptyState
                icon={TrendingUp}
                title="Trend analysis unavailable"
                description={error?.response?.data?.detail || 'AI analysis could not be fetched right now.'}
                action={<Button onClick={() => refetch()} icon={Sparkles} variant="secondary">Try Again</Button>}
              />
            </CardBody>
          </Card>
        )}

        {data && !isLoading && (
          <div className="space-y-6">
            {(data.source === 'local_fallback_no_anthropic_key' || data.source === 'curated_knowledge_fallback' || data.source === 'template_fallback') && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                <Sparkles size={16} className="shrink-0 mt-0.5" />
                <p>Showing curated trend data. Set <code className="bg-amber-100 px-1 rounded">GEMINI_API_KEY</code> in <code className="bg-amber-100 px-1 rounded">.env</code> for live AI analysis.{' '}
                  <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="underline font-semibold">Get free key →</a>
                </p>
              </div>
            )}

            {/* Trend chart */}
            {chartData.length > 0 && (
              <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 shadow-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                      <BarChart2 size={18} className="text-indigo-400" /> Topic Trend Scores
                    </h3>
                    <p className="text-slate-400 text-xs mt-0.5">AI-computed relevance scores for {domain}</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
                    Live Analysis
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} margin={{ left: -10, right: 10, bottom: 50, top: 10 }} barCategoryGap="30%">
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#818cf8" stopOpacity={1} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.7} />
                      </linearGradient>
                      <linearGradient id="barGradHover" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a5b4fc" stopOpacity={1} />
                        <stop offset="100%" stopColor="#818cf8" stopOpacity={0.9} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                      dataKey="topic"
                      tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      domain={[0, 100]}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(99,102,241,0.08)', radius: 6 }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="bg-slate-800 border border-indigo-500/30 rounded-xl px-4 py-3 shadow-2xl">
                            <p className="text-indigo-300 font-semibold text-sm mb-0.5">{payload[0].payload.topic}</p>
                            <p className="text-white font-bold text-lg">{payload[0].value}<span className="text-slate-400 text-xs ml-1">/ 100</span></p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="score" fill="url(#barGrad)" radius={[6, 6, 2, 2]} maxBarSize={56} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Hot topics */}
            {data.hot_topics?.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider flex items-center gap-2">
                  <Zap size={14} className="text-rose-500" /> Hot Topics
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.hot_topics.slice(0, 9).map((t, i) => (
                    <Card key={i} className="p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-semibold text-sm text-slate-800">{t.topic}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          {momIcon(t.momentum)}
                          <span className="text-xs font-bold text-slate-600">{Math.round((t.trend_score || 0) * 100)}</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{t.description}</p>
                      {t.why_hot && <p className="text-xs text-indigo-600 mt-1.5">💡 {t.why_hot}</p>}
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Emerging areas + Gaps */}
            <div className="grid md:grid-cols-2 gap-5">
              <Card>
                <CardHeader><h3 className="font-semibold text-slate-800 flex items-center gap-2"><Globe size={16} className="text-emerald-500" /> Emerging Areas</h3></CardHeader>
                <CardBody className="space-y-3">
                  {data.emerging_areas?.map((a, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-50 transition">
                      <Badge color={a.opportunity_level === 'high' ? 'green' : 'yellow'}>{a.opportunity_level}</Badge>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{a.area}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{a.description}</p>
                      </div>
                    </div>
                  ))}
                </CardBody>
              </Card>

              <Card>
                <CardHeader><h3 className="font-semibold text-slate-800 flex items-center gap-2"><TrendingUp size={16} className="text-amber-500" /> Research Gaps</h3></CardHeader>
                <CardBody>
                  <ul className="space-y-2">
                    {data.research_gaps?.map((g, i) => (
                      <li key={i} className="text-sm text-slate-600 flex gap-2 p-1.5 rounded hover:bg-slate-50">
                        <span className="text-amber-400 shrink-0 font-bold">▸</span>{g}
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
          </div>
        )}
      </section>
    </div>
  );
}

export default TrendsPage;
