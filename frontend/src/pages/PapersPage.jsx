/**
 * pages/PapersPage.jsx
 * List, search, filter, and create papers. Includes AI summarization trigger.
 */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, FileText, Filter, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import {
  Card, CardBody, Button, Badge, StatusBadge, PageLoader,
  EmptyState, SectionTitle, Modal, Input, Textarea, Select
} from '../components/Shared/UI';
import { papersAPI, aiAPI } from '../api/client';
import { useAuthStore } from '../store';

const STATUSES = ['','draft','in_review','submitted','accepted','rejected','published'];

// ── Create Paper Modal ────────────────────────────────────────────────────
function CreatePaperModal({ open, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ title: '', abstract: '', keywords: '', project_id: '' });

  const mutation = useMutation({
    mutationFn: (data) => papersAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['papers']);
      toast.success('Paper created!');
      onClose();
      setForm({ title: '', abstract: '', keywords: '', project_id: '' });
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed to create paper'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate({
      ...form,
      keywords: form.keywords.split(',').map(k => k.trim()).filter(Boolean),
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Create New Paper" maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Title *" value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Paper title..." required />
        <Textarea label="Abstract" value={form.abstract} rows={5}
          onChange={e => setForm(f => ({ ...f, abstract: e.target.value }))}
          placeholder="Paper abstract..." />
        <Input label="Keywords (comma-separated)" value={form.keywords}
          onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
          placeholder="machine learning, NLP, transformers" />
        <div className="flex gap-3 pt-2 justify-end">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" loading={mutation.isPending} icon={Plus}>Create Paper</Button>
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
function PaperCard({ paper, onSummarize }) {
  const navigate = useNavigate();
  return (
    <Card className="hover:shadow-md transition-all group">
      <CardBody>
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 onClick={() => navigate(`/papers/${paper.id}`)}
            className="font-semibold text-slate-800 text-sm leading-snug group-hover:text-indigo-700 cursor-pointer transition-colors line-clamp-2">
            {paper.title}
          </h3>
          <StatusBadge status={paper.status} />
        </div>
        {paper.abstract && (
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-3">{paper.abstract}</p>
        )}
        <div className="flex flex-wrap gap-1 mb-3">
          {(paper.keywords || []).slice(0, 4).map(kw => (
            <Badge key={kw} color="default">{kw}</Badge>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {formatDistanceToNow(new Date(paper.updated_at), { addSuffix: true })}
          </span>
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="xs" variant="ghost" icon={Sparkles}
              onClick={() => onSummarize(paper)}>
              AI Summary
            </Button>
            <Button size="xs" variant="secondary"
              onClick={() => navigate(`/papers/${paper.id}`)}>
              Open
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function PapersPage() {
  const [searchParams] = useSearchParams();
  const [search,    setSearch]    = useState('');
  const [status,    setStatus]    = useState('');
  const [showCreate, setShowCreate] = useState(searchParams.get('new') === '1');
  const [summarizePaper, setSummarizePaper] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['papers', search, status],
    queryFn: () => papersAPI.list({
      search: search || undefined,
      status: status || undefined,
      limit: 20,
    }).then(r => r.data),
    keepPreviousData: true,
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
                  onSummarize={setSummarizePaper} />
              ))}
            </div>
      }

      <CreatePaperModal open={showCreate} onClose={() => setShowCreate(false)} />
      <SummarizeModal paper={summarizePaper} open={!!summarizePaper}
        onClose={() => setSummarizePaper(null)} />
    </div>
  );
}
