/**
 * pages/ProjectsPage.jsx + ProjectDetailPage.jsx
 * Improved with: clickable cards, file upload, delete buttons, organized layout.
 */
import { useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, FolderKanban, Users, FileText,
  CheckCircle, Circle, ArrowLeft, Calendar, Edit2,
  Tag, Upload, Trash2, Download, ExternalLink,
  Bookmark, Share2, Sparkles
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import {
  Card, CardHeader, CardBody, Badge, Button, StatusBadge,
  PageLoader, EmptyState, SectionTitle, Modal, Input, Textarea, ProgressBar, Select
} from '../components/Shared/UI';
import { projectsAPI } from '../api/client';
import { useAuthStore, useSavedStore } from '../store';

// ── Create Project Modal ──────────────────────────────────────────────────
function CreateProjectModal({ open, onClose }) {
  const qc = useQueryClient();
  const fileInputRef = useRef(null);
  const [uploadMethod, setUploadMethod] = useState('manual');
  const [form, setForm] = useState({ title:'', description:'', tags:'', is_public: false, file: null });

  const mut = useMutation({
    mutationFn: async (data) => {
      if (data.file) {
        const formData = new FormData();
        formData.append('title', data.title);
        formData.append('description', data.description || '');
        formData.append('tags', JSON.stringify(data.tags));
        formData.append('is_public', data.is_public ? 'true' : 'false');
        formData.append('file', data.file);
        return projectsAPI.createWithFile(formData);
      }
      // Don't send `file` field in JSON — backend ProjectCreate has no file field
      const { file, ...jsonData } = data;
      return projectsAPI.create(jsonData);
    },
    onSuccess: () => {
      qc.invalidateQueries(['projects']);
      toast.success('Project created!');
      onClose();
      setForm({ title:'', description:'', tags:'', is_public: false, file: null });
      setUploadMethod('manual');
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed to create project'),
  });

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 100 * 1024 * 1024) {
        toast.error('File size must be less than 100MB');
        return;
      }
      setForm(f => ({ ...f, file }));
      toast.success(`File selected: ${file.name}`);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    mut.mutate({
      ...form,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Create New Project" maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Upload Method Tabs */}
        <div className="flex gap-2 border-b">
          <button type="button" onClick={() => setUploadMethod('manual')}
            className={`px-4 py-2 font-medium border-b-2 transition ${
              uploadMethod === 'manual'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}>Manual Entry</button>
          <button type="button" onClick={() => setUploadMethod('file')}
            className={`px-4 py-2 font-medium border-b-2 transition flex items-center gap-2 ${
              uploadMethod === 'file'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}><Upload size={16} /> Upload File</button>
        </div>

        {uploadMethod === 'manual' && (
          <div className="space-y-4">
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
          </div>
        )}

        {uploadMethod === 'file' && (
          <div className="space-y-4">
            <div className="relative">
              <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" />
              <div onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition">
                <Upload className="mx-auto mb-2 text-slate-400" size={32} />
                <p className="font-medium text-slate-700">Click to upload or drag and drop</p>
                <p className="text-sm text-slate-500">Any file type (up to 100MB)</p>
                {form.file && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
                    ✓ {form.file.name}
                  </div>
                )}
              </div>
            </div>
            <Input label="Title *" value={form.title}
              onChange={e => setForm(f => ({...f, title: e.target.value}))} required placeholder="Project title..." />
            <Input label="Tags (comma-separated)" value={form.tags}
              onChange={e => setForm(f => ({...f, tags: e.target.value}))} placeholder="nlp, ml, vision" />
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={form.is_public}
                onChange={e => setForm(f => ({...f, is_public: e.target.checked}))} className="rounded" />
              Make project public
            </label>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mut.isPending} icon={Plus}>Create</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Project Card ─────────────────────────────────────────────────────────
function ProjectCard({ project, onDeleteClick }) {
  const navigate = useNavigate();
  const handleCardClick = () => navigate(`/projects/${project.id}`);

  return (
    <div className="bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-lg transition-all cursor-pointer group"
      onClick={handleCardClick}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-slate-800 text-sm leading-snug line-clamp-2 group-hover:text-indigo-700 transition-colors flex-1">
            {project.title}
          </h3>
          <StatusBadge status={project.status} />
        </div>
      </div>

      {/* Description */}
      {project.description && (
        <div className="px-4 pb-2">
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{project.description}</p>
        </div>
      )}

      {/* Progress bar */}
      <div className="px-4 pb-2">
        <ProgressBar value={project.milestone_total > 0
          ? Math.round(project.milestone_completed / project.milestone_total * 100) : 0} showLabel />
      </div>

      {/* Tags */}
      {(project.tags || []).length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1">
          {(project.tags || []).slice(0, 3).map(t => <Badge key={t} color="default">{t}</Badge>)}
        </div>
      )}

      {/* Meta + Actions */}
      <div className="px-4 pb-3 pt-2 flex items-center justify-between border-t border-slate-100">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1"><Users size={11}/>{project.member_count || 0}</span>
          <span className="flex items-center gap-1"><FileText size={11}/>{project.paper_count || 0}</span>
        </div>
        <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
          {project.file_url && (
            <button onClick={() => window.open(projectsAPI.downloadUrl(project.file_url), '_blank')}
              className="px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition flex items-center gap-1"
              title="View file"><Download size={12} /> File</button>
          )}
          <button onClick={() => onDeleteClick(project)}
            className="px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition flex items-center gap-1"
            title="Delete project"><Trash2 size={12} /> Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Projects list page ────────────────────────────────────────────────────
export function ProjectsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [myOnly, setMyOnly] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['projects', search, myOnly],
    queryFn: () => projectsAPI.list({ search: search||undefined, my_only: myOnly, limit:20 }).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (projectId) => projectsAPI.delete(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries(['projects']);
      toast.success('Project deleted');
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed to delete project'),
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
              <ProjectCard key={proj.id} project={proj}
                onDeleteClick={setDeleteTarget} />
            ))}
          </div>
      }

      <CreateProjectModal open={showCreate} onClose={() => setShowCreate(false)} />

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        title="Delete Project" maxWidth="max-w-md">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <Trash2 size={20} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700">
              Are you sure you want to delete <strong>"{deleteTarget?.title}"</strong>? This action cannot be undone.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null); }}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Project status update modal ──────────────────────────────────────────
function ProjectStatusModal({ projectId, currentStatus, open, onClose }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState(currentStatus);
  const STATUSES = ['planning', 'active', 'completed'];

  const mut = useMutation({
    mutationFn: () => projectsAPI.update(projectId, { status }),
    onSuccess: () => {
      qc.invalidateQueries(['project', projectId]);
      qc.invalidateQueries(['projects']);
      toast.success(`Status updated to ${status}`);
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed to update status'),
  });

  return (
    <Modal open={open} onClose={onClose} title="Update Project Status">
      <div className="space-y-4">
        <Select label="New Status" value={status} onChange={e => setStatus(e.target.value)}>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
        </Select>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mut.mutate()} loading={mut.isPending}>Update</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Project share modal ──────────────────────────────────────────────────
function ProjectShareModal({ project, open, onClose }) {
  const shareUrl = window.location.href;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        toast.success('Project link copied to clipboard!');
        onClose();
      })
      .catch(() => toast.error('Failed to copy link'));
  };

  return (
    <Modal open={open} onClose={onClose} title="Share Project" maxWidth="max-w-md">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Share <strong>"{project.title}"</strong> with your collaborators:</p>
        <div className="flex gap-2">
          <input readOnly value={shareUrl} className="flex-1 px-3 py-2 text-sm border rounded-lg bg-slate-50 text-slate-500 focus:outline-none" />
          <Button onClick={handleCopyLink}>Copy Link</Button>
        </div>
        <div className="border-t pt-3">
          <Button variant="secondary" size="sm" className="w-full justify-start"
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: project.title,
                  text: `Check out this project: ${project.title}`,
                  url: shareUrl,
                }).catch(console.error);
              } else {
                window.location.href = `mailto:?subject=${encodeURIComponent(project.title)}&body=${encodeURIComponent(shareUrl)}`;
              }
              onClose();
            }}>
            🔗 Share via System
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Project detail page ───────────────────────────────────────────────────
export function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { saveProject, unsaveProject, isSavedProject } = useSavedStore();
  const qc = useQueryClient();
  const [msTitle, setMsTitle] = useState('');
  const [showAddMs, setShowAddMs] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const { data: proj, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsAPI.get(id).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: () => projectsAPI.delete(id),
    onSuccess: () => {
      qc.invalidateQueries(['projects']);
      toast.success('Project deleted');
      navigate('/projects');
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed to delete project'),
  });

  const completeMut = useMutation({
    mutationFn: (msId) => projectsAPI.completeMilestone(id, msId),
    onSuccess: () => { qc.invalidateQueries(['project', id]); toast.success('Milestone completed!'); },
  });

  const addMsMut = useMutation({
    mutationFn: () => projectsAPI.addMilestone(id, { title: msTitle }),
    onSuccess: () => { qc.invalidateQueries(['project', id]); setMsTitle(''); setShowAddMs(false); toast.success('Milestone added'); },
  });

  const joinMut = useMutation({
    mutationFn: () => projectsAPI.join(id),
    onSuccess: () => {
      qc.invalidateQueries(['project', id]);
      toast.success("Successfully joined the workspace!");
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Failed to join project.");
    }
  });

  if (isLoading) return <PageLoader />;
  if (!proj) return <div className="p-8 text-slate-500">Project not found.</div>;

  const isOwner = String(proj.owner_id) === String(user?.id);
  const isMember = proj.members?.some(m => String(m.user_id) === String(user?.id));
  const isSaved = isSavedProject(proj.id);
  const pct = proj.milestone_total > 0
    ? Math.round(proj.milestone_completed / proj.milestone_total * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Back + actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate(-1)}>Back</Button>
        <div className="flex gap-2">
          {isOwner && (
            <Button variant="ghost" icon={Trash2} size="sm"
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
              onClick={() => setShowDelete(true)}>Delete</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main content Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* Header card */}
          <Card>
            <CardBody>
              <div className="flex items-start justify-between gap-4 mb-4">
                <h1 className="text-xl font-bold text-slate-800 leading-snug flex-1">{proj.title}</h1>
                <StatusBadge status={proj.status} />
              </div>
              {proj.description && <p className="text-sm text-slate-600 mb-4">{proj.description}</p>}
              
              {/* Progress */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Progress</span><span>{pct}%</span>
                </div>
                <ProgressBar value={pct} />
              </div>

              {/* File download */}
              {proj.file_url && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText size={20} className="text-blue-600" />
                    <div className="text-sm">
                      <p className="font-semibold text-blue-900">Project File Attached</p>
                      <p className="text-xs text-blue-700">Download or view the uploaded file</p>
                    </div>
                  </div>
                  <a href={projectsAPI.downloadUrl(proj.file_url)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-blue-300 hover:bg-blue-50 text-blue-700 rounded-lg text-sm font-medium transition">
                    <Download size={16} /> Download
                  </a>
                </div>
              )}

              {/* Tags */}
              <div className="flex flex-wrap gap-1">
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
                  {isMember && (
                    <Button size="xs" icon={Plus} variant="secondary" onClick={() => setShowAddMs(true)}>Add</Button>
                  )}
                </div>
              </CardHeader>
              <CardBody className="space-y-2">
                {!proj.milestones?.length
                  ? <p className="text-sm text-slate-400">No milestones yet.</p>
                  : proj.milestones.map(ms => (
                      <div key={ms.id} className="flex items-center gap-3 group">
                        <button onClick={() => !ms.completed_at && isMember && completeMut.mutate(ms.id)}
                          disabled={!isMember}
                          className={`shrink-0 text-slate-300 hover:text-indigo-500 transition-colors ${!isMember ? 'cursor-not-allowed' : ''}`}>
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
        </div>

        {/* Quick Actions Column */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-none shadow-md bg-white overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-indigo-100">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
                <Sparkles size={16} className="text-indigo-600" />
                Quick Actions
              </h3>
            </CardHeader>
            <CardBody className="space-y-3 p-4">
              {isMember && (
                <Button variant="secondary" size="sm" icon={Edit2} className="w-full justify-start border-slate-200"
                  onClick={() => setShowStatus(true)}>
                  Update Status
                </Button>
              )}
              
              <Button variant="secondary" size="sm" icon={Share2} className="w-full justify-start border-slate-200"
                onClick={() => setShowShare(true)}>
                Share Project
              </Button>

              <Button
                variant={isSaved ? 'success' : 'secondary'}
                size="sm"
                icon={Bookmark}
                className="w-full justify-start border-slate-200"
                onClick={() => {
                  if (isSaved) {
                    unsaveProject(proj.id);
                    toast.success('Project removed from saved items');
                  } else {
                    saveProject(proj);
                    toast.success('Project saved successfully!');
                  }
                }}
              >
                {isSaved ? 'Saved Project' : 'Save Project'}
              </Button>

              {!isMember && (
                <Button variant="primary" size="sm" icon={Plus} className="w-full justify-start"
                  loading={joinMut.isPending}
                  onClick={() => joinMut.mutate()}>
                  Join Workspace
                </Button>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Add Milestone Modal */}
      <Modal open={showAddMs} onClose={() => setShowAddMs(false)} title="Add Milestone">
        <div className="space-y-4">
          <Input label="Milestone title" value={msTitle} onChange={e => setMsTitle(e.target.value)} placeholder="e.g. Submit draft to arXiv" />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setShowAddMs(false)}>Cancel</Button>
            <Button onClick={() => addMsMut.mutate()} loading={addMsMut.isPending} disabled={!msTitle}>Add</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={showDelete} onClose={() => setShowDelete(false)}
        title="Delete Project" maxWidth="max-w-md">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <Trash2 size={20} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700">
              Are you sure you want to delete <strong>"{proj?.title}"</strong>? This action cannot be undone.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteMutation.mutate()} loading={deleteMutation.isPending}>Delete</Button>
          </div>
        </div>
      </Modal>

      {/* Project Status Update Modal */}
      <ProjectStatusModal open={showStatus} onClose={() => setShowStatus(false)} projectId={proj.id} currentStatus={proj.status} />

      {/* Project Share Modal */}
      <ProjectShareModal open={showShare} onClose={() => setShowShare(false)} project={proj} />
    </div>
  );
}

export default ProjectsPage;