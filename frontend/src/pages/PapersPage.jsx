/**
 * pages/PapersPage.jsx
 * List, search, filter, and create papers. Includes AI summarization trigger.
 */
import { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, FileText, Filter, Sparkles, Upload, Cloud, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import {
  Card, CardBody, Button, Badge, StatusBadge, PageLoader,
  EmptyState, SectionTitle, Modal, Input, Textarea, Select
} from '../components/Shared/UI';
import { papersAPI, aiAPI } from '../api/client';
import { useAuthStore, useUIStore } from '../store';

const STATUSES = ['','draft','in_review','submitted','accepted','rejected','published'];

// ── Create Paper Modal ────────────────────────────────────────────────────
function CreatePaperModal({ open, onClose, onCreated }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [form, setForm] = useState({ title: '', abstract: '', keywords: '', project_id: '', file: null });
  const [uploadMethod, setUploadMethod] = useState('manual'); // 'manual', 'device', 'google-drive'
  const [isUploading, setIsUploading] = useState(false);

  const mutation = useMutation({
    mutationFn: async (data) => {
      const formData = new FormData();
      formData.append('title', data.title);
      formData.append('abstract', data.abstract);
      formData.append('keywords', JSON.stringify(data.keywords));
      if (data.project_id) formData.append('project_id', data.project_id);
      if (data.file) formData.append('file', data.file);
      
      return papersAPI.createWithFile(formData);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries(['papers']);
      toast.success('Paper created!');
      onCreated?.({ title: form.title });
      onClose();
      setForm({ title: '', abstract: '', keywords: '', project_id: '', file: null });
      setUploadMethod('manual');
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed to create paper'),
  });

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)) {
        toast.error('Only PDF and Word documents are supported');
        return;
      }
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        toast.error('File size must be less than 50MB');
        return;
      }
      setForm(f => ({ ...f, file }));
      toast.success(`File selected: ${file.name}`);
    }
  };

  const handleGoogleDriveConnect = () => {
    // Placeholder for Google Drive OAuth flow
    toast.info('Opening Google Drive... (feature coming soon)');
    // In production, this would initiate Google OAuth and file selection
    // For now, we'll show a modal to paste a Google Drive URL or select file
    const driveUrl = prompt('Paste your Google Drive file URL or ID:');
    if (driveUrl) {
      setForm(f => ({ ...f, file: new File([], driveUrl, { type: 'text/plain' }) }));
      toast.success('Google Drive file will be processed');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    mutation.mutate({
      ...form,
      keywords: form.keywords.split(',').map(k => k.trim()).filter(Boolean),
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Create New Paper" maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Upload Method Tabs */}
        <div className="flex gap-2 border-b">
          <button
            type="button"
            onClick={() => setUploadMethod('manual')}
            className={`px-4 py-2 font-medium border-b-2 transition ${
              uploadMethod === 'manual'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Manual Entry
          </button>
          <button
            type="button"
            onClick={() => setUploadMethod('device')}
            className={`px-4 py-2 font-medium border-b-2 transition flex items-center gap-2 ${
              uploadMethod === 'device'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload size={16} /> From Device
          </button>
          <button
            type="button"
            onClick={() => setUploadMethod('google-drive')}
            className={`px-4 py-2 font-medium border-b-2 transition flex items-center gap-2 ${
              uploadMethod === 'google-drive'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cloud size={16} /> Google Drive
          </button>
        </div>

        {/* Manual Entry */}
        {uploadMethod === 'manual' && (
          <div className="space-y-4">
            <Input label="Title *" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Paper title..." required />
            <Textarea label="Abstract" value={form.abstract} rows={5}
              onChange={e => setForm(f => ({ ...f, abstract: e.target.value }))}
              placeholder="Paper abstract..." />
            <Input label="Keywords (comma-separated)" value={form.keywords}
              onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
              placeholder="machine learning, NLP, transformers" />
          </div>
        )}

        {/* Upload from Device */}
        {uploadMethod === 'device' && (
          <div className="space-y-4">
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition"
              >
                <Upload className="mx-auto mb-2 text-slate-400" size={32} />
                <p className="font-medium text-slate-700">Click to upload or drag and drop</p>
                <p className="text-sm text-slate-500">PDF or Word documents (up to 50MB)</p>
                {form.file && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
                    ✓ {form.file.name}
                  </div>
                )}
              </div>
            </div>
            <Input label="Title *" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Paper title..." required />
            <Input label="Keywords (comma-separated)" value={form.keywords}
              onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
              placeholder="machine learning, NLP, transformers" />
          </div>
        )}

        {/* Google Drive */}
        {uploadMethod === 'google-drive' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
              <Cloud className="mx-auto mb-3 text-blue-600" size={40} />
              <h3 className="font-semibold text-blue-900 mb-2">Connect Google Drive</h3>
              <p className="text-sm text-blue-700 mb-4">
                Select a PDF or Word document from your Google Drive
              </p>
              <Button
                type="button"
                onClick={handleGoogleDriveConnect}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Cloud size={16} className="mr-2" />
                Select from Google Drive
              </Button>
            </div>
            <Input label="Title *" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Paper title..." required />
          </div>
        )}

        <div className="flex gap-3 pt-4 justify-end">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" loading={mutation.isPending} icon={Plus}>
            {uploadMethod === 'manual' ? 'Create Paper' : 'Upload & Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── AI Summarize Modal ────────────────────────────────────────────────────
function SummarizeModal({ paper, open, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ['ai-summary', paper?.id],
    queryFn: () => aiAPI.summarizePaper(paper.id).then(r => r.data),
    enabled: open && !!paper?.id,
    staleTime: Infinity,
    retry: false,
  });

  return (
    <Modal open={open} onClose={onClose} title={`✨ AI Summary: ${paper?.title?.slice(0, 50)}...`} maxWidth="max-w-2xl">
      {isLoading
        ? <div className="flex items-center gap-3 text-indigo-600 py-4">
            <div className="animate-spin text-lg">⚙️</div> Analyzing paper...
          </div>
        : data
          ? <div className="space-y-4 text-sm">
              {data.tldr && (
                <div className="bg-indigo-50 rounded-lg p-3">
                  <p className="font-semibold text-indigo-700 text-xs uppercase mb-1">TL;DR</p>
                  <p className="text-slate-700">{data.tldr}</p>
                </div>
              )}
              {data.summary && (
                <div>
                  <p className="font-semibold text-slate-700 mb-1">Summary</p>
                  <p className="text-slate-600 leading-relaxed">{data.summary}</p>
                </div>
              )}
              {data.key_contributions?.length > 0 && (
                <div>
                  <p className="font-semibold text-slate-700 mb-1">Key Contributions</p>
                  <ul className="space-y-1">
                    {data.key_contributions.map((c, i) => (
                      <li key={i} className="text-slate-600 flex gap-2">
                        <span className="text-indigo-400 shrink-0">▸</span>{c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {data.significance && (
                <div>
                  <p className="font-semibold text-slate-700 mb-1">Significance</p>
                  <p className="text-slate-600">{data.significance}</p>
                </div>
              )}
            </div>
          : <p className="text-slate-500">Could not generate summary. Please try again.</p>
      }
    </Modal>
  );
}

// ── Paper Card ────────────────────────────────────────────────────────────
function PaperCard({ paper, onSummarize, onDeleteClick }) {
  const navigate = useNavigate();
  const handleCardClick = () => navigate(`/papers/${paper.id}`);

  return (
    <div className="bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-lg transition-all cursor-pointer group"
      onClick={handleCardClick}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-slate-800 text-sm leading-snug line-clamp-2 group-hover:text-indigo-700 transition-colors flex-1">
            {paper.title}
          </h3>
          <StatusBadge status={paper.status} />
        </div>
      </div>

      {/* Abstract */}
      {paper.abstract && (
        <div className="px-4 pb-2">
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{paper.abstract}</p>
        </div>
      )}

      {/* Keywords */}
      {(paper.keywords || []).length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1">
          {(paper.keywords || []).slice(0, 4).map(kw => (
            <Badge key={kw} color="default">{kw}</Badge>
          ))}
        </div>
      )}

      {/* Meta + Actions — single line */}
      <div className="px-4 pb-3 pt-2 flex items-center justify-between border-t border-slate-100">
        <span className="text-xs text-slate-400 whitespace-nowrap">
          {formatDistanceToNow(new Date(paper.updated_at), { addSuffix: true })}
        </span>
        <div className="flex gap-1.5 flex-nowrap" onClick={(e) => e.stopPropagation()}>
          {paper.pdf_url && (
            <button
              onClick={() => window.open(papersAPI.downloadUrl(paper.pdf_url), '_blank')}
              className="px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition flex items-center gap-1"
              title="View PDF">
              <FileText size={12} />
              PDF
            </button>
          )}
          <button
            onClick={() => onSummarize(paper)}
            className="px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50 rounded-lg transition flex items-center gap-1"
            title="AI Summary">
            <Sparkles size={12} />
            Summarize
          </button>
          <button
            onClick={() => onDeleteClick(paper)}
            className="px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition flex items-center gap-1"
            title="Delete paper">
            <Trash2 size={12} />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function PapersPage() {
  const [searchParams] = useSearchParams();
  const [search,    setSearch]    = useState('');
  const [status,    setStatus]    = useState('');
  const [showCreate, setShowCreate] = useState(searchParams.get('new') === '1');
  const [summarizePaper, setSummarizePaper] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const queryClient = useQueryClient();
  const { addNotification } = useUIStore();

  const { data, isLoading } = useQuery({
    queryKey: ['papers', search, status],
    queryFn: () => papersAPI.list({
      search: search || undefined,
      status: status || undefined,
      limit: 20,
    }).then(r => r.data),
    keepPreviousData: true,
  });

  const deleteMutation = useMutation({
    mutationFn: (paperId) => papersAPI.delete(paperId),
    onSuccess: (_, paperId) => {
      queryClient.invalidateQueries(['papers']);
      toast.success('Paper deleted');
      addNotification({ type: 'paper', title: 'Paper deleted', message: `"${deleteTarget?.title}" was permanently deleted.` });
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed to delete paper'),
  });

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <SectionTitle
        subtitle={`${data?.total ?? 0} papers found`}
        action={
          <Button icon={Plus} onClick={() => setShowCreate(true)}>New Paper</Button>
        }
      >
        Research Papers
      </SectionTitle>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Search papers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
          {STATUSES.map(s => (
            <option key={s} value={s}>{s ? s.replace('_', ' ') : 'All statuses'}</option>
          ))}
        </select>
      </div>

      {/* Paper grid */}
      {isLoading
        ? <PageLoader />
        : !data?.items?.length
          ? <EmptyState icon={FileText} title="No papers found"
              description="Create your first paper or adjust the filters."
              action={<Button icon={Plus} onClick={() => setShowCreate(true)}>Create Paper</Button>} />
          : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.items.map(paper => (
                <PaperCard key={paper.id} paper={paper}
                  onSummarize={setSummarizePaper}
                  onDeleteClick={setDeleteTarget} />
              ))}
            </div>
      }

      <CreatePaperModal open={showCreate} onClose={() => setShowCreate(false)}
        onCreated={(p) => addNotification({ type: 'paper', title: 'Paper created', message: `"${p.title}" was successfully created.` })} />
      <SummarizeModal paper={summarizePaper} open={!!summarizePaper}
        onClose={() => setSummarizePaper(null)} />

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        title="Delete Paper" maxWidth="max-w-md">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <Trash2 size={20} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700">
              Are you sure you want to delete <strong>"{deleteTarget?.title}"</strong>? This action cannot be undone.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
