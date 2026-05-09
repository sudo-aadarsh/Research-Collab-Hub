/**
 * pages/PaperDetailPage.jsx
 * Full paper view: metadata, authors, references, AI summary, venue recommendations.
 * Enhanced with beautiful UI, detailed information, and better visual hierarchy.
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Sparkles, BookOpen, Users, Edit2,
  Upload, Building, CheckCircle, Tag, ExternalLink, Download, FileText, Trash2,
  Calendar, MapPin, Award, TrendingUp, GitBranch, Eye, Share2, Bookmark, Clock, Globe, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Card, CardHeader, CardBody, Badge, Button, StatusBadge,
  PageLoader, AIResultBox, Modal, Select, SectionTitle
} from '../components/Shared/UI';
import { papersAPI, aiAPI, referencesAPI, projectsAPI } from '../api/client';
import { useAuthStore, useSavedStore } from '../store';
import { format } from 'date-fns';

// ── Save Paper Modal ──────────────────────────────────────────────────────
function SavePaperModal({ paper, open, onClose }) {
  const { savePaper, isSavedPaper } = useSavedStore();
  const [isSaved, setIsSaved] = useState(isSavedPaper(paper.id));

  const handleSave = () => {
    savePaper(paper);
    setIsSaved(true);
    toast.success('Paper saved! View it in the Saved section.');
    setTimeout(onClose, 1500);
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <p className="text-sm text-blue-900 mb-3">
          {isSaved ? '✓ Paper already saved!' : '📌 Save this paper to your collection'}
        </p>
        <div className="bg-white rounded p-3 text-sm text-slate-600 border border-blue-100">
          <p className="font-medium mb-1 text-slate-800" title={paper.title}>
            "{paper.title.substring(0, 60)}{paper.title.length > 60 ? '...' : ''}"
          </p>
          <p className="text-xs text-slate-500">
            {paper.authors?.slice(0, 2).map(a => a.author_name).join(', ')}
            {paper.authors?.length > 2 ? ' et al.' : ''}
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSave}
          disabled={isSaved}
          className={isSaved ? 'bg-slate-300' : 'bg-blue-600 hover:bg-blue-700'}
        >
          {isSaved ? '✓ Saved' : '+ Save Paper'}
        </Button>
      </div>
    </div>
  );
}

// ── Add Reference Modal ───────────────────────────────────────────────────
function AddReferenceModal({ paperId, open, onClose, onSuccess }) {
  const [tab, setTab] = useState('create'); // 'create' or 'existing'
  const [formData, setFormData] = useState({
    title: '',
    authors: [],
    year: new Date().getFullYear(),
    journal: '',
    conference: '',
    doi: '',
  });
  const [authorInput, setAuthorInput] = useState('');
  const queryClient = useQueryClient();

  const addRefMutation = useMutation({
    mutationFn: async () => {
      // Create new reference
      const res = await referencesAPI.create({
        ...formData,
        authors: formData.authors.length > 0 ? formData.authors : [authorInput],
      });
      // Link it to paper
      await referencesAPI.linkToPaper(paperId, res.data.id, {});
      return res;
    },
    onSuccess: () => {
      onSuccess();
      setFormData({
        title: '',
        authors: [],
        year: new Date().getFullYear(),
        journal: '',
        conference: '',
        doi: '',
      });
      setAuthorInput('');
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed to add reference'),
  });

  const handleAddAuthor = () => {
    if (authorInput.trim()) {
      setFormData(prev => ({
        ...prev,
        authors: [...prev.authors, authorInput.trim()],
      }));
      setAuthorInput('');
    }
  };

  const handleRemoveAuthor = (index) => {
    setFormData(prev => ({
      ...prev,
      authors: prev.authors.filter((_, i) => i !== index),
    }));
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Reference" maxWidth="max-w-lg">
      <div className="space-y-4">
        <div className="flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setTab('create')}
            className={`px-4 py-2 text-sm font-medium transition ${
              tab === 'create'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Create New
          </button>
          <button
            onClick={() => setTab('existing')}
            className={`px-4 py-2 text-sm font-medium transition ${
              tab === 'existing'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Link Existing
          </button>
        </div>

        {tab === 'create' ? (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Paper title"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Authors</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={authorInput}
                  onChange={(e) => setAuthorInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddAuthor()}
                  placeholder="Enter author name"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <Button size="sm" onClick={handleAddAuthor}>Add</Button>
              </div>
              {formData.authors.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.authors.map((a, i) => (
                    <Badge key={i} color="indigo" className="flex items-center gap-1">
                      {a}
                      <button onClick={() => handleRemoveAuthor(i)} className="ml-1 hover:bg-indigo-700 rounded px-1">×</button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Year</label>
                <input
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">DOI</label>
                <input
                  type="text"
                  value={formData.doi}
                  onChange={(e) => setFormData(prev => ({ ...prev, doi: e.target.value }))}
                  placeholder="10.xxxx/xxxxx"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Journal / Conference</label>
              <input
                type="text"
                value={formData.journal || formData.conference}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    journal: val,
                    conference: val,
                  }));
                }}
                placeholder="Publication venue"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 text-center">
            <p className="text-sm text-slate-600">
              💡 To link existing references, please create them first in the References section.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {tab === 'create' && (
            <Button
              onClick={() => addRefMutation.mutate()}
              loading={addRefMutation.isPending}
              disabled={!formData.title}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300"
            >
              Add Reference
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

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

// Helper component for stats cards
function StatCard({ icon: Icon, label, value, color = 'indigo' }) {
  const colorClasses = {
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
  };

  return (
    <div className={`${colorClasses[color]} border rounded-lg p-4 flex items-center gap-3`}>
      <Icon size={20} />
      <div>
        <p className="text-xs font-medium opacity-75">{label}</p>
        <p className="text-lg font-bold">{value}</p>
      </div>
    </div>
  );
}

// Helper component for author card
function AuthorCard({ author }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-start gap-3 hover:bg-slate-50 transition">
      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
        <span className="text-sm font-semibold text-indigo-600">
          {author.author_name?.charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-medium text-sm text-slate-900 truncate">
            {author.author_name}
          </p>
          {author.is_corresponding && (
            <Badge color="amber" className="text-xs">Corresponding</Badge>
          )}
        </div>
        {author.author_email && (
          <p className="text-xs text-slate-500 truncate">{author.author_email}</p>
        )}
      </div>
    </div>
  );
}

export default function PaperDetailPage() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [showStatus,     setShowStatus]     = useState(false);
  const [showVenues,     setShowVenues]     = useState(false);
  const [showDelete,     setShowDelete]     = useState(false);
  const [showShare,      setShowShare]      = useState(false);
  const [showSaveForLater, setShowSaveForLater] = useState(false);
  const [showNewVersion, setShowNewVersion] = useState(false);
  const [showAddRef,     setShowAddRef]     = useState(false);
  const [newVersionNote, setNewVersionNote] = useState('');
  const queryClient = useQueryClient();

  const { data: paper, isLoading } = useQuery({
    queryKey: ['paper', id],
    queryFn:  () => papersAPI.get(id).then(r => r.data),
  });

  const { data: project } = useQuery({
    queryKey: ['project', paper?.project_id],
    queryFn:  () => paper?.project_id ? projectsAPI.get(paper.project_id).then(r => r.data) : null,
    enabled:  !!paper?.project_id,
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

  const deleteMutation = useMutation({
    mutationFn: () => papersAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['papers']);
      toast.success('Paper deleted');
      navigate('/papers');
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed to delete paper'),
  });

  // Quick action mutations
  const newVersionMutation = useMutation({
    mutationFn: () => papersAPI.create({
      title: `${paper.title} (v${(paper.version || 1) + 1})`,
      abstract: paper.abstract,
      keywords: paper.keywords,
      project_id: paper.project_id,
    }),
    onSuccess: (response) => {
      queryClient.invalidateQueries(['papers']);
      toast.success('New version created');
      setShowNewVersion(false);
      setNewVersionNote('');
      navigate(`/papers/${response.data.id}`);
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed to create new version'),
  });

  if (isLoading) return <PageLoader />;
  if (!paper) return <div className="text-slate-500 p-8">Paper not found.</div>;

  const isAuthor = paper.authors?.some(a => a.user_id === user?.id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-indigo-50">
      {/* Header Navigation */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200 backdrop-blur-sm bg-opacity-90">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate(-1)}>
            Back
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
            <Button variant="ghost" icon={Trash2} size="sm"
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
              onClick={() => setShowDelete(true)}>
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Top Grid: Hero & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Hero Section */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl p-8 text-white shadow-lg h-full flex flex-col justify-center">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                  <h1 className="text-4xl font-bold leading-snug mb-3">{paper.title}</h1>
                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    {paper.authors?.map((a, i) => (
                      <span key={i} className="text-indigo-100">
                        {a.is_corresponding ? <strong>{a.author_name}</strong> : a.author_name}
                        {i < paper.authors.length - 1 && ','}
                      </span>
                    ))}
                  </div>
                </div>
                <StatusBadge status={paper.status} />
              </div>
              
              <div className="flex flex-wrap items-center gap-6 text-indigo-100 text-sm mt-auto">
                <div className="flex items-center gap-2">
                  <Calendar size={16} />
                  <span>{format(new Date(paper.created_at), 'MMM dd, yyyy')}</span>
                </div>
                {paper.doi && (
                  <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 hover:text-white transition">
                    <Globe size={16} />
                    <span className="underline">{paper.doi}</span>
                  </a>
                )}
                {paper.arxiv_id && (
                  <a href={`https://arxiv.org/abs/${paper.arxiv_id}`} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 hover:text-white transition">
                    <ExternalLink size={16} />
                    <span className="underline">arXiv</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="lg:col-span-1">
            <Card className="h-full border-none shadow-md bg-white overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-indigo-100">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Sparkles size={18} className="text-indigo-600" />
                  Quick Actions
                </h3>
              </CardHeader>
              <CardBody className="space-y-3 p-5">
                <Button variant="secondary" size="md" icon={Share2} className="w-full justify-start border-slate-200"
                  onClick={() => setShowShare(true)}>
                  Share Paper
                </Button>
                <Button variant="secondary" size="md" icon={Bookmark} className="w-full justify-start border-slate-200"
                  onClick={() => setShowSaveForLater(true)}>
                  Save for Later
                </Button>
                <Button variant="secondary" size="md" icon={GitBranch} className="w-full justify-start border-slate-200"
                  onClick={() => setShowNewVersion(true)}>
                  Create New Version
                </Button>
              </CardBody>
            </Card>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Tag} label="Keywords" value={paper.keywords?.length || 0} color="blue" />
          {paper.word_count && <StatCard icon={Clock} label="Word Count" value={paper.word_count} color="green" />}
          {paper.page_count && <StatCard icon={Award} label="Pages" value={paper.page_count} color="purple" />}
        </div>

        {/* PDF Section */}
        {paper.pdf_url && (
          <Card className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardBody>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <FileText size={24} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Paper PDF Available</p>
                    <p className="text-sm text-slate-600">Original document uploaded with this paper</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <a href={papersAPI.downloadUrl(paper.pdf_url)}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-300 hover:bg-blue-50 text-blue-700 rounded-lg font-medium transition">
                    <Eye size={16} />
                    View PDF
                  </a>
                  <a href={papersAPI.downloadUrl(paper.pdf_url)} download
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition">
                    <Download size={16} />
                    Download
                  </a>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Main Content Layout */}
        <div className="space-y-8">
          
          {/* Project Association */}
          {project && (
            <Card>
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Building size={18} className="text-green-600" />
                  Associated Project
                </h3>
              </CardHeader>
              <CardBody>
                <button 
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="w-full text-left p-4 rounded-lg border-2 border-green-200 hover:bg-green-50 transition flex flex-col md:flex-row gap-4 items-center"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-lg text-slate-900 mb-1">{project.title}</p>
                    <p className="text-sm text-slate-600 line-clamp-2">{project.description}</p>
                  </div>
                  <Button variant="secondary" size="sm">View Project</Button>
                </button>
              </CardBody>
            </Card>
          )}

          {/* Abstract */}
          {paper.abstract && (
            <Card>
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <BookOpen size={18} className="text-indigo-600" />
                  Abstract
                </h3>
              </CardHeader>
              <CardBody>
                <p className="text-slate-700 leading-relaxed text-lg">{paper.abstract}</p>
              </CardBody>
            </Card>
          )}

          {/* Authors and References Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Authors Detailed */}
            {paper.authors?.length > 0 && (
              <Card className="h-full">
                <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Users size={18} className="text-amber-600" />
                    Authors ({paper.authors.length})
                  </h3>
                </CardHeader>
                <CardBody>
                  <div className="grid grid-cols-1 gap-3">
                    {paper.authors.map(a => (
                      <AuthorCard key={a.id} author={a} />
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}

            {/* References */}
            <Card className="h-full">
              <CardHeader className="bg-gradient-to-r from-rose-50 to-pink-50">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <BookOpen size={18} className="text-rose-600" />
                    References ({refs?.length ?? 0})
                  </h3>
                  <Button size="sm" variant="secondary" onClick={() => setShowAddRef(true)}
                    className="text-xs h-fit">
                    + Add
                  </Button>
                </div>
              </CardHeader>
              <CardBody>
                {!refs?.length ? (
                  <div className="flex items-center gap-2 text-slate-500 p-4 bg-slate-50 rounded-lg">
                    <AlertCircle size={16} />
                    <span className="text-sm">No references linked yet.</span>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {refs.map((r, i) => (
                      <div key={r.id} className="text-sm border-b border-slate-100 pb-3 last:border-0 hover:bg-slate-50 p-2 rounded transition">
                        <div className="flex gap-3">
                          <span className="text-slate-400 font-semibold flex-shrink-0 w-6 text-center">[{i + 1}]</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-800 mb-1">
                              <span className="font-medium">{r.authors?.slice(0, 2).join(', ')}</span>
                              {r.authors?.length > 2 && ' et al.'} <span className="text-slate-500">({r.year})</span>
                            </p>
                            <p className="text-slate-700 italic mb-1">{r.title}</p>
                            <p className="text-slate-600 text-xs">
                              {r.journal || r.conference}
                              {r.doi && (
                                <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer"
                                  className="text-indigo-500 ml-2 hover:underline inline-flex items-center gap-1">
                                  DOI <ExternalLink size={12} />
                                </a>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Keywords */}
          {paper.keywords?.length > 0 && (
            <Card>
              <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Tag size={18} className="text-purple-600" />
                  Keywords & Topics
                </h3>
              </CardHeader>
              <CardBody>
                <div className="flex flex-wrap gap-2">
                  {paper.keywords.map(kw => (
                    <Badge key={kw} color="indigo" className="text-sm py-1 px-3">
                      {kw}
                    </Badge>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          {/* AI Summary */}
          <AIResultBox loading={loadingSummary} title="✨ AI Summary & Analysis">
            {aiSummary && !aiSummary.error && (
              <div className="space-y-4">
                {aiSummary.tldr && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                    <span className="font-bold text-indigo-700 text-sm uppercase block mb-2">TL;DR — Quick Overview</span>
                    <p className="text-indigo-900">{aiSummary.tldr}</p>
                  </div>
                )}
                
                <div className="grid md:grid-cols-2 gap-4">
                  {aiSummary.key_contributions?.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-lg p-4">
                      <p className="font-semibold text-slate-700 text-xs uppercase mb-3 flex items-center gap-2">
                        <CheckCircle size={14} className="text-green-600" />
                        Key Contributions
                      </p>
                      <ul className="space-y-2">
                        {aiSummary.key_contributions.map((c, i) => (
                          <li key={i} className="text-sm text-slate-600 flex gap-2">
                            <span className="text-green-500 font-bold flex-shrink-0">•</span>
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {(aiSummary.methodology || aiSummary.significance) && (
                    <div className="space-y-3">
                      {aiSummary.methodology && (
                        <div className="bg-white border border-slate-200 rounded-lg p-4">
                          <p className="font-semibold text-slate-700 text-xs uppercase mb-2 flex items-center gap-2">
                            <TrendingUp size={14} className="text-blue-600" />
                            Methodology
                          </p>
                          <p className="text-sm text-slate-600">{aiSummary.methodology}</p>
                        </div>
                      )}
                      {aiSummary.significance && (
                        <div className="bg-white border border-slate-200 rounded-lg p-4">
                          <p className="font-semibold text-slate-700 text-xs uppercase mb-2 flex items-center gap-2">
                            <Award size={14} className="text-purple-600" />
                            Significance
                          </p>
                          <p className="text-sm text-slate-600">{aiSummary.significance}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            {aiSummary?.error && (
              <div className="flex items-center gap-2 text-slate-500 p-3 bg-slate-50 rounded-lg">
                <AlertCircle size={16} />
                <span className="text-sm">Add a complete abstract to enable AI-powered summaries.</span>
              </div>
            )}
          </AIResultBox>

          {/* Venue Recommendations */}
          {showVenues && (
            <AIResultBox loading={loadingVenues} title="✨ AI Venue Recommendations">
              {venueRecs && (
                <div className="space-y-4">
                  {venueRecs.overall_strategy && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                      <p className="font-semibold text-indigo-700 text-sm mb-2">Strategy</p>
                      <p className="text-indigo-900 text-sm">{venueRecs.overall_strategy}</p>
                    </div>
                  )}
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Conferences */}
                    <div>
                      <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                        <Building size={16} className="text-blue-600" />
                        Top Conferences
                      </h4>
                      <div className="space-y-3">
                        {venueRecs.top_conferences?.slice(0, 3).map((c, i) => (
                          <div key={i} className="bg-white border border-slate-200 rounded-lg p-3 hover:shadow-md transition">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className="font-medium text-slate-800 text-sm">{c.name}</p>
                              <Badge color={c.acceptance_probability === 'high' ? 'green' : c.acceptance_probability === 'medium' ? 'yellow' : 'red'} className="text-xs">
                                {c.acceptance_probability}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-600 mb-2">{c.reasoning}</p>
                            {c.tips && <p className="text-xs text-indigo-600">💡 {c.tips}</p>}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Journals */}
                    <div>
                      <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                        <BookOpen size={16} className="text-purple-600" />
                        Top Journals
                      </h4>
                      <div className="space-y-3">
                        {venueRecs.top_journals?.slice(0, 3).map((j, i) => (
                          <div key={i} className="bg-white border border-slate-200 rounded-lg p-3 hover:shadow-md transition">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className="font-medium text-slate-800 text-sm">{j.name}</p>
                              <Badge color="purple" className="text-xs">IF: {j.fit_score?.toFixed(2)}</Badge>
                            </div>
                            <p className="text-xs text-slate-600 mb-2">{j.reasoning}</p>
                            {j.expected_review_time && (
                              <p className="text-xs text-slate-500">⏱ Review time: ~{j.expected_review_time}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </AIResultBox>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal open={showDelete} onClose={() => setShowDelete(false)}
        title="Delete Paper" maxWidth="max-w-md">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <Trash2 size={20} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700">
              Are you sure you want to delete <strong>"{paper?.title}"</strong>? This action cannot be undone.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowDelete(false)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteMutation.mutate()}
              loading={deleteMutation.isPending}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Share Paper Modal */}
      <Modal open={showShare} onClose={() => setShowShare(false)} title="Share Paper" maxWidth="max-w-md">
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <p className="text-sm text-slate-600 mb-3">Share this paper with these options:</p>
            <div className="space-y-2">
              <Button variant="secondary" size="sm" className="w-full justify-start"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success('Link copied to clipboard!');
                  setShowShare(false);
                }}>
                📋 Copy Link
              </Button>
              <Button variant="secondary" size="sm" className="w-full justify-start"
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: paper.title,
                      text: `Check out this paper: ${paper.title}`,
                      url: window.location.href,
                    });
                  } else {
                    toast.error('Share not supported on this device');
                  }
                }}>
                🔗 Share via System
              </Button>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowShare(false)}>Close</Button>
          </div>
        </div>
      </Modal>

      {/* Save for Later Modal */}
      <Modal open={showSaveForLater} onClose={() => setShowSaveForLater(false)} 
        title="Save for Later" maxWidth="max-w-md">
        <SavePaperModal 
          paper={paper}
          open={showSaveForLater}
          onClose={() => setShowSaveForLater(false)}
        />
      </Modal>

      {/* Create New Version Modal */}
      <Modal open={showNewVersion} onClose={() => setShowNewVersion(false)} 
        title="Create New Version" maxWidth="max-w-md">
        <div className="space-y-4">
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <p className="text-sm text-purple-900 mb-3">
              Creating a new version of: <strong className="text-purple-800">{paper.title}</strong>
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Version Notes (optional)</label>
              <textarea 
                value={newVersionNote} 
                onChange={(e) => setNewVersionNote(e.target.value)}
                placeholder="What changed in this version?"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                rows="3"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => {
              setShowNewVersion(false);
              setNewVersionNote('');
            }}>
              Cancel
            </Button>
            <Button onClick={() => newVersionMutation.mutate()} 
              loading={newVersionMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700">
              Create Version
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Reference Modal */}
      <AddReferenceModal 
        paperId={id} 
        open={showAddRef} 
        onClose={() => setShowAddRef(false)}
        onSuccess={() => {
          queryClient.invalidateQueries(['paper-refs', id]);
          setShowAddRef(false);
          toast.success('Reference added successfully!');
        }}
      />

      <StatusModal paperId={id} currentStatus={paper.status}
        open={showStatus} onClose={() => setShowStatus(false)} />
    </div>
  );
}
