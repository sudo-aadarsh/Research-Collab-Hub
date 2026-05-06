/**
 * pages/PaperDetailPage.jsx
 * Full paper view: metadata, authors, references, AI summary, venue recommendations.
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Sparkles, BookOpen, Users, Edit2,
  Upload, Building, CheckCircle, Tag, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Card, CardHeader, CardBody, Badge, Button, StatusBadge,
  PageLoader, AIResultBox, Modal, Select, SectionTitle
} from '../components/Shared/UI';
import { papersAPI, aiAPI, referencesAPI } from '../api/client';
import { useAuthStore } from '../store';
import { format } from 'date-fns';

// ── Status change modal ───────────────────────────────────────────────────
function StatusModal({ paperId, currentStatus, open, onClose }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState(currentStatus);
  const STATUSES = ['draft','in_review','submitted','accepted','rejected','published'];

  const mut = useMutation({
    mutationFn: () => papersAPI.setStatus(paperId, { status }),
    onSuccess: () => {
      qc.invalidateQueries(['paper', paperId]);
      toast.success(`Status updated to ${status}`);
      onClose();
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Update Paper Status">
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

export default function PaperDetailPage() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [showStatus,  setShowStatus]  = useState(false);
  const [showVenues,  setShowVenues]  = useState(false);

  const { data: paper, isLoading } = useQuery({
    queryKey: ['paper', id],
    queryFn:  () => papersAPI.get(id).then(r => r.data),
  });

  const { data: refs } = useQuery({
    queryKey: ['paper-refs', id],
    queryFn:  () => referencesAPI.getPaperRefs(id).then(r => r.data),
  });

  const { data: aiSummary, isLoading: loadingSummary } = useQuery({
    queryKey: ['ai-summary', id],
    queryFn:  () => aiAPI.summarizePaper(id).then(r => r.data),
    enabled:  !!id,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: venueRecs, isLoading: loadingVenues } = useQuery({
    queryKey: ['venue-recs', id],
    queryFn:  () => aiAPI.getVenueRecs(id).then(r => r.data),
    enabled:  showVenues,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isLoading) return <PageLoader />;
  if (!paper) return <div className="text-slate-500 p-8">Paper not found.</div>;

  const isAuthor = paper.authors?.some(a => a.user_id === user?.id);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back + actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('/papers')}>
          Back to Papers
        </Button>
        <div className="flex gap-2">
          {isAuthor && (
            <Button variant="secondary" icon={Edit2} size="sm"
              onClick={() => setShowStatus(true)}>
              Update Status
            </Button>
          )}
          <Button icon={Sparkles} size="sm" onClick={() => setShowVenues(v => !v)}>
            Venue Recommendations
          </Button>
        </div>
      </div>

      {/* Header card */}
      <Card>
        <CardBody>
          <div className="flex items-start justify-between gap-4 mb-4">
            <h1 className="text-xl font-bold text-slate-900 leading-snug flex-1">{paper.title}</h1>
            <StatusBadge status={paper.status} />
          </div>

          {/* Authors */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Users size={14} className="text-slate-400 shrink-0" />
            {paper.authors?.map((a, i) => (
              <span key={i} className="text-sm text-slate-600">
                {a.is_corresponding ? <strong>{a.author_name}</strong> : a.author_name}
                {i < paper.authors.length - 1 && ','}
              </span>
            ))}
          </div>

          {/* Keywords */}
          {paper.keywords?.length > 0 && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <Tag size={14} className="text-slate-400 shrink-0" />
              {paper.keywords.map(kw => <Badge key={kw} color="indigo">{kw}</Badge>)}
            </div>
          )}

          {/* Metadata row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
            <div><span className="font-medium block text-slate-700">Version</span>v{paper.version}</div>
            <div><span className="font-medium block text-slate-700">Created</span>
              {format(new Date(paper.created_at), 'MMM d, yyyy')}
            </div>
            {paper.doi && (
              <div>
                <span className="font-medium block text-slate-700">DOI</span>
                <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noreferrer"
                  className="text-indigo-600 hover:underline flex items-center gap-1">
                  {paper.doi.slice(0, 20)}... <ExternalLink size={10} />
                </a>
              </div>
            )}
            {paper.submission_date && (
              <div><span className="font-medium block text-slate-700">Submitted</span>
                {format(new Date(paper.submission_date), 'MMM d, yyyy')}
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Abstract */}
      {paper.abstract && (
        <Card>
          <CardHeader><h3 className="font-semibold text-slate-800">Abstract</h3></CardHeader>
          <CardBody>
            <p className="text-sm text-slate-700 leading-relaxed">{paper.abstract}</p>
          </CardBody>
        </Card>
      )}

      {/* AI Summary */}
      <AIResultBox loading={loadingSummary} title="✨ AI Summary">
        {aiSummary && !aiSummary.error && (
          <div className="space-y-3 text-sm">
            {aiSummary.tldr && (
              <div className="bg-white rounded-lg p-3 border border-indigo-100">
                <span className="font-semibold text-indigo-700 text-xs uppercase">TL;DR — </span>
                <span className="text-slate-700">{aiSummary.tldr}</span>
              </div>
            )}
            {aiSummary.key_contributions?.length > 0 && (
              <div>
                <p className="font-semibold text-slate-700 text-xs uppercase mb-1">Key Contributions</p>
                <ul className="space-y-0.5">
                  {aiSummary.key_contributions.map((c, i) => (
                    <li key={i} className="text-slate-600 flex gap-2 text-xs">
                      <CheckCircle size={12} className="text-indigo-400 shrink-0 mt-0.5" />{c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {aiSummary.methodology && (
              <p className="text-xs text-slate-600">
                <span className="font-semibold">Methodology: </span>{aiSummary.methodology}
              </p>
            )}
            {aiSummary.significance && (
              <p className="text-xs text-slate-600">
                <span className="font-semibold">Significance: </span>{aiSummary.significance}
              </p>
            )}
          </div>
        )}
        {aiSummary?.error && <p className="text-sm text-slate-500">Add an abstract to enable AI summaries.</p>}
      </AIResultBox>

      {/* Venue Recommendations */}
      {showVenues && (
        <AIResultBox loading={loadingVenues} title="✨ AI Venue Recommendations">
          {venueRecs && (
            <div className="space-y-4">
              {venueRecs.overall_strategy && (
                <p className="text-sm text-slate-600 bg-white p-3 rounded-lg border border-indigo-100">
                  <span className="font-semibold text-slate-700">Strategy: </span>
                  {venueRecs.overall_strategy}
                </p>
              )}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-700 uppercase mb-2">Top Conferences</p>
                  {venueRecs.top_conferences?.slice(0, 3).map((c, i) => (
                    <div key={i} className="bg-white rounded-lg p-3 border border-slate-100 mb-2">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm text-slate-800">{c.name}</p>
                        <Badge color={c.acceptance_probability === 'high' ? 'green' : c.acceptance_probability === 'medium' ? 'yellow' : 'red'}>
                          {c.acceptance_probability}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500">{c.reasoning}</p>
                      {c.tips && <p className="text-xs text-indigo-600 mt-1">💡 {c.tips}</p>}
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700 uppercase mb-2">Top Journals</p>
                  {venueRecs.top_journals?.slice(0, 3).map((j, i) => (
                    <div key={i} className="bg-white rounded-lg p-3 border border-slate-100 mb-2">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm text-slate-800">{j.name}</p>
                        <Badge color="indigo">IF: {j.fit_score?.toFixed(2)}</Badge>
                      </div>
                      <p className="text-xs text-slate-500">{j.reasoning}</p>
                      {j.expected_review_time && (
                        <p className="text-xs text-slate-400 mt-1">⏱ ~{j.expected_review_time}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </AIResultBox>
      )}

      {/* References */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <BookOpen size={16} /> References ({refs?.length ?? 0})
            </h3>
          </div>
        </CardHeader>
        <CardBody className="space-y-2">
          {!refs?.length
            ? <p className="text-sm text-slate-400">No references linked yet.</p>
            : refs.map((r, i) => (
                <div key={r.id} className="text-sm text-slate-700 border-b border-slate-50 pb-2 last:border-0">
                  <span className="text-slate-400 mr-2">[{i + 1}]</span>
                  <span className="font-medium">{r.authors?.slice(0, 3).join(', ')}</span>
                  {r.authors?.length > 3 && ' et al.'} ({r.year}).{' '}
                  <em>{r.title}.</em>{' '}
                  {r.journal || r.conference}
                  {r.doi && (
                    <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer"
                      className="text-indigo-500 ml-1 hover:underline">DOI</a>
                  )}
                </div>
              ))
          }
        </CardBody>
      </Card>

      <StatusModal paperId={id} currentStatus={paper.status}
        open={showStatus} onClose={() => setShowStatus(false)} />
    </div>
  );
}
