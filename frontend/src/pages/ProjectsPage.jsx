/**
 * pages/ProjectsPage.jsx + ProjectDetailPage.jsx
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, FolderKanban, Users, FileText,
  CheckCircle, Circle, ArrowLeft, Calendar, Edit2
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  Card, CardHeader, CardBody, Badge, Button, StatusBadge,
  PageLoader, EmptyState, SectionTitle, Modal, Input, Textarea, ProgressBar
} from '../components/Shared/UI';
import { projectsAPI } from '../api/client';
import { useAuthStore } from '../store';

// ── Create Project Modal ──────────────────────────────────────────────────
function CreateProjectModal({ open, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title:'', description:'', tags:'', is_public: false });
  const mut = useMutation({
    mutationFn: (data) => projectsAPI.create(data),
    onSuccess: () => { qc.invalidateQueries(['projects']); toast.success('Project created!'); onClose(); },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed'),
  });
  const handleSubmit = (e) => {
    e.preventDefault();
    mut.mutate({ ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean) });
  };
  return (
    <Modal open={open} onClose={onClose} title="Create New Project">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Title *" value={form.title}
          onChange={e => setForm(f => ({...f, title: e.target.value}))} required placeholder="Project title..." />
        <Textarea label="Description" value={form.description} rows={3}
          onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="What is this project about?" />
        <Input label="Tags (comma-separated)" value={form.tags}
          onChange={e => setForm(f => ({...f, tags: e.target.value}))} placeholder="nlp, ml, vision" />
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={form.is_public}
            onChange={e => setForm(f => ({...f, is_public: e.target.checked}))} className="rounded" />
          Make project public
        </label>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mut.isPending} icon={Plus}>Create</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Projects list page ────────────────────────────────────────────────────
export function ProjectsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [myOnly, setMyOnly] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['projects', search, myOnly],
    queryFn: () => projectsAPI.list({ search: search||undefined, my_only: myOnly, limit:20 }).then(r => r.data),
  });

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <SectionTitle subtitle={`${data?.total ?? 0} projects`}
        action={<Button icon={Plus} onClick={() => setShowCreate(true)}>New Project</Button>}>
        Research Projects
      </SectionTitle>

      <div className="flex gap-3 flex-wrap items-center">
        <input className="flex-1 min-w-48 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={myOnly} onChange={e => setMyOnly(e.target.checked)} className="rounded" />
          My projects
        </label>
      </div>

      {isLoading ? <PageLoader /> :
       !data?.items?.length
        ? <EmptyState icon={FolderKanban} title="No projects found"
            action={<Button icon={Plus} onClick={() => setShowCreate(true)}>Create Project</Button>} />
        : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.items.map(proj => (
              <Card key={proj.id} onClick={() => navigate(`/projects/${proj.id}`)} className="p-4 cursor-pointer">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-semibold text-sm text-slate-800 line-clamp-2">{proj.title}</p>
                  <StatusBadge status={proj.status} />
                </div>
                {proj.description && <p className="text-xs text-slate-500 line-clamp-2 mb-3">{proj.description}</p>}
                <ProgressBar value={proj.progress_pct ?? 0} showLabel />
                <div className="flex gap-3 mt-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Users size={11}/>{proj.member_count}</span>
                  <span className="flex items-center gap-1"><FileText size={11}/>{proj.paper_count}</span>
                  {proj.next_deadline && (
                    <span className="flex items-center gap-1 ml-auto text-amber-600">
                      <Calendar size={11}/>{format(new Date(proj.next_deadline), 'MMM d')}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(proj.tags || []).slice(0,3).map(t => <Badge key={t} color="default">{t}</Badge>)}
                </div>
              </Card>
            ))}
          </div>
      }
      <CreateProjectModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}

// ── Project detail page ───────────────────────────────────────────────────
export function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [msTitle, setMsTitle] = useState('');
  const [showAddMs, setShowAddMs] = useState(false);

  const { data: proj, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsAPI.get(id).then(r => r.data),
  });

  const completeMut = useMutation({
    mutationFn: (msId) => projectsAPI.completeMilestone(id, msId),
    onSuccess: () => { qc.invalidateQueries(['project', id]); toast.success('Milestone completed!'); },
  });
  const addMsMut = useMutation({
    mutationFn: () => projectsAPI.addMilestone(id, { title: msTitle }),
    onSuccess: () => { qc.invalidateQueries(['project', id]); setMsTitle(''); setShowAddMs(false); toast.success('Milestone added'); },
  });

  if (isLoading) return <PageLoader />;
  if (!proj) return <div className="p-8 text-slate-500">Project not found.</div>;

  const isOwner = str(proj.owner_id) === str(user?.id);
  const pct = proj.milestone_total > 0
    ? Math.round(proj.milestone_completed / proj.milestone_total * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('/projects')}>Back</Button>
        <StatusBadge status={proj.status} />
      </div>

      <Card>
        <CardBody>
          <h1 className="text-xl font-bold text-slate-800 mb-2">{proj.title}</h1>
          {proj.description && <p className="text-sm text-slate-600 mb-4">{proj.description}</p>}
          <div className="mb-3">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Progress</span><span>{pct}%</span>
            </div>
            <ProgressBar value={pct} />
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {(proj.tags || []).map(t => <Badge key={t} color="indigo">{t}</Badge>)}
          </div>
        </CardBody>
      </Card>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Milestones */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">
                Milestones ({proj.milestone_completed}/{proj.milestone_total})
              </h3>
              {isOwner && (
                <Button size="xs" icon={Plus} variant="secondary" onClick={() => setShowAddMs(true)}>Add</Button>
              )}
            </div>
          </CardHeader>
          <CardBody className="space-y-2">
            {!proj.milestones?.length
              ? <p className="text-sm text-slate-400">No milestones yet.</p>
              : proj.milestones.map(ms => (
                  <div key={ms.id} className="flex items-center gap-3 group">
                    <button onClick={() => !ms.completed_at && completeMut.mutate(ms.id)}
                      className="shrink-0 text-slate-300 hover:text-indigo-500 transition-colors">
                      {ms.completed_at
                        ? <CheckCircle size={18} className="text-emerald-500" />
                        : <Circle size={18} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${ms.completed_at ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                        {ms.title}
                      </p>
                      {ms.due_date && (
                        <p className="text-xs text-slate-400">{format(new Date(ms.due_date), 'MMM d, yyyy')}</p>
                      )}
                    </div>
                  </div>
                ))
            }
          </CardBody>
        </Card>

        {/* Members */}
        <Card>
          <CardHeader><h3 className="font-semibold text-slate-800">Members ({proj.members?.length ?? 0})</h3></CardHeader>
          <CardBody className="space-y-2">
            {proj.members?.map(m => (
              <div key={m.user_id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                  {m.name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{m.name}</p>
                  <Badge color="default">{m.role}</Badge>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <Modal open={showAddMs} onClose={() => setShowAddMs(false)} title="Add Milestone">
        <div className="space-y-4">
          <Input label="Milestone title" value={msTitle} onChange={e => setMsTitle(e.target.value)} placeholder="e.g. Submit draft to arXiv" />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setShowAddMs(false)}>Cancel</Button>
            <Button onClick={() => addMsMut.mutate()} loading={addMsMut.isPending} disabled={!msTitle}>Add</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function str(v) { return v ? String(v) : ''; }

export default ProjectsPage;
