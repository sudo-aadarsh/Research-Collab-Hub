/**
 * pages/DashboardPage.jsx
 * Main dashboard: stats overview, recent papers, upcoming deadlines,
 * collaborator recommendations, and quick-action buttons.
 */
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  FileText, FolderKanban, Users, Calendar, TrendingUp,
  Plus, ArrowRight, AlertCircle, Sparkles, Clock
} from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import {
  Card, CardHeader, CardBody, Badge, Button, StatusBadge,
  PageLoader, EmptyState, AIResultBox, ProgressBar, Spinner
} from '../components/Shared/UI';
import { papersAPI, projectsAPI, venuesAPI, aiAPI } from '../api/client';
import { useAuthStore } from '../store';

// ── Stat card ─────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'indigo', onClick }) {
  const colorMap = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green:  'bg-emerald-50 text-emerald-600',
    amber:  'bg-amber-50  text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <Card onClick={onClick} className="flex items-center gap-4 p-5">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value ?? '—'}</p>
        <p className="text-sm text-slate-500">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </Card>
  );
}

// ── Deadline row ──────────────────────────────────────────────────────────
function DeadlineRow({ name, abbreviation, deadline, daysRemaining }) {
  const urgent = daysRemaining <= 7;
  const soon   = daysRemaining <= 30;
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{abbreviation || name}</p>
        <p className="text-xs text-slate-400">{name}</p>
      </div>
      <div className="text-right shrink-0 ml-3">
        <p className={`text-xs font-semibold ${urgent ? 'text-red-600' : soon ? 'text-amber-600' : 'text-slate-600'}`}>
          {daysRemaining > 0 ? `${daysRemaining}d left` : 'Passed'}
        </p>
        <p className="text-xs text-slate-400">{format(new Date(deadline), 'MMM d')}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const { data: myPapers, isLoading: loadingPapers } = useQuery({
    queryKey: ['my-papers'],
    queryFn: () => papersAPI.list({ author_id: user?.id, limit: 5 }).then(r => r.data),
  });

  const { data: myProjects, isLoading: loadingProjects } = useQuery({
    queryKey: ['my-projects'],
    queryFn: () => projectsAPI.list({ my_only: true, limit: 5 }).then(r => r.data),
  });

  const { data: deadlines } = useQuery({
    queryKey: ['upcoming-deadlines'],
    queryFn: () => venuesAPI.listConferences({ upcoming: true, limit: 5 }).then(r => r.data),
  });

  const { data: aiDirections, isLoading: loadingDirections } = useQuery({
    queryKey: ['ai-directions'],
    queryFn: () => aiAPI.getDirections().then(r => r.data),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Paper status breakdown
  const paperStats = myPapers?.items?.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {}) || {};

  const totalPapers   = myPapers?.total   ?? 0;
  const totalProjects = myProjects?.total  ?? 0;
  const activeProjects= myProjects?.items?.filter(p => p.status === 'active').length ?? 0;
  const publishedCount= paperStats.published ?? 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          Welcome back, {user?.full_name?.split(' ')[0]} 👋
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {user?.institution && `${user.institution} · `}
          Here's your research overview.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText}     label="Total Papers"     value={totalPapers}
          sub={`${publishedCount} published`} color="indigo"
          onClick={() => navigate('/papers')} />
        <StatCard icon={FolderKanban} label="Projects"         value={totalProjects}
          sub={`${activeProjects} active`} color="green"
          onClick={() => navigate('/projects')} />
        <StatCard icon={TrendingUp}   label="H-Index"          value={user?.h_index ?? 0}
          color="purple" />
        <StatCard icon={Calendar}     label="Upcoming Deadlines"
          value={deadlines?.items?.filter(d => d.days_remaining > 0).length ?? 0}
          sub="conference deadlines" color="amber"
          onClick={() => navigate('/conferences')} />
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Recent papers */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Recent Papers</h3>
              <div className="flex gap-2">
                <Button size="xs" variant="secondary" onClick={() => navigate('/papers')}>
                  View all
                </Button>
                <Button size="xs" icon={Plus} onClick={() => navigate('/papers?new=1')}>
                  New
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {loadingPapers ? <PageLoader /> :
             !myPapers?.items?.length
              ? <EmptyState icon={FileText} title="No papers yet"
                  description="Start by creating your first paper."
                  action={<Button size="sm" icon={Plus} onClick={() => navigate('/papers?new=1')}>Create Paper</Button>} />
              : myPapers.items.map(paper => (
                <div key={paper.id}
                  onClick={() => navigate(`/papers/${paper.id}`)}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{paper.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Updated {formatDistanceToNow(new Date(paper.updated_at), { addSuffix: true })}
                    </p>
                  </div>
                  <StatusBadge status={paper.status} />
                </div>
              ))
            }
          </CardBody>
        </Card>

        {/* Upcoming deadlines */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-amber-500" />
              <h3 className="font-semibold text-slate-800">Upcoming Deadlines</h3>
            </div>
          </CardHeader>
          <CardBody className="py-2">
            {!deadlines?.items?.length
              ? <p className="text-sm text-slate-400 py-4 text-center">No upcoming deadlines</p>
              : deadlines.items.slice(0, 6).map(d => (
                  <DeadlineRow key={d.venue_id || d.id}
                    name={d.name} abbreviation={d.abbreviation}
                    deadline={d.deadline || d.submission_deadline}
                    daysRemaining={d.days_remaining ?? 99} />
                ))
            }
            <Button variant="ghost" size="xs" className="w-full mt-2 justify-center"
              onClick={() => navigate('/conferences')}>
              View all venues <ArrowRight size={12} />
            </Button>
          </CardBody>
        </Card>
      </div>

      {/* Projects progress */}
      {!!myProjects?.items?.length && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Active Projects</h3>
              <Button size="xs" variant="secondary" onClick={() => navigate('/projects')}>
                All Projects
              </Button>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myProjects.items.filter(p => p.status === 'active').slice(0, 3).map(proj => (
                <div key={proj.id}
                  onClick={() => navigate(`/projects/${proj.id}`)}
                  className="border border-slate-100 rounded-lg p-4 hover:border-indigo-200 hover:shadow-sm cursor-pointer transition-all">
                  <p className="font-medium text-sm text-slate-800 truncate mb-2">{proj.title}</p>
                  <ProgressBar value={proj.progress_pct ?? 0} showLabel />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-slate-400">{proj.member_count} members</span>
                    <span className="text-xs text-slate-400">{proj.paper_count} papers</span>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* AI Research Directions */}
      <AIResultBox loading={loadingDirections} title="✨ AI: Suggested Research Directions">
        {aiDirections?.recommended_directions?.length
          ? <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {aiDirections.recommended_directions.slice(0, 4).map((dir, i) => (
                <div key={i} className="bg-white rounded-lg p-3 border border-indigo-100">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold text-slate-800">{dir.title}</p>
                    <Badge color={dir.potential_impact === 'high' ? 'green' : 'indigo'}>
                      {dir.potential_impact} impact
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{dir.description}</p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Badge color="default">{dir.feasibility} feasibility</Badge>
                    <Badge color="default">{dir.estimated_timeline}</Badge>
                  </div>
                </div>
              ))}
            </div>
          : <p className="text-sm text-slate-500">
              {aiDirections?.error
                ? 'Add research interests to your profile to get AI-powered direction suggestions.'
                : 'No directions available. Add research interests to your profile.'}
            </p>
        }
        <Button size="xs" variant="ghost" className="mt-3"
          onClick={() => navigate('/trends')}>
          <Sparkles size={12} /> Explore Full Trend Analysis
        </Button>
      </AIResultBox>

    </div>
  );
}
