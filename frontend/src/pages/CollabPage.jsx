/**
 * pages/CollabPage.jsx
 * Collaboration requests + AI-powered collaborator recommendations.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Sparkles, UserPlus, CheckCircle, XCircle, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Card, CardHeader, CardBody, Badge, Button,
  PageLoader, EmptyState, SectionTitle, AIResultBox, Modal, Textarea
} from '../components/Shared/UI';
import { collabAPI, aiAPI } from '../api/client';
import { useAuthStore } from '../store';

function RequestCard({ req, type, onRespond }) {
  const person = type === 'incoming' ? req.requester : req.target;
  const statusColors = { pending:'yellow', accepted:'green', declined:'red' };
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold shrink-0">
            {person?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-sm text-slate-800">{person?.name}</p>
            <p className="text-xs text-slate-500">{person?.institution}</p>
          </div>
        </div>
        <Badge color={statusColors[req.status] || 'default'}>{req.status}</Badge>
      </div>
      {req.message && (
        <p className="text-xs text-slate-600 mt-3 bg-slate-50 rounded-lg p-2 italic">"{req.message}"</p>
      )}
      {type === 'incoming' && req.status === 'pending' && (
        <div className="flex gap-2 mt-3">
          <Button size="xs" icon={CheckCircle} variant="success"
            onClick={() => onRespond(req.id, 'accepted')}>Accept</Button>
          <Button size="xs" icon={XCircle} variant="danger"
            onClick={() => onRespond(req.id, 'declined')}>Decline</Button>
        </div>
      )}
    </Card>
  );
}

function CollabRecCard({ rec }) {
  const [showSend, setShowSend] = useState(false);
  const [msg, setMsg] = useState('');
  const qc = useQueryClient();

  const sendMut = useMutation({
    mutationFn: () => collabAPI.sendRequest({ target_id: rec.recommended_user.id, message: msg }),
    onSuccess: () => { toast.success('Request sent!'); setShowSend(false); qc.invalidateQueries(['outgoing']); },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed'),
  });

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white flex items-center justify-center font-bold shrink-0">
            {rec.recommended_user?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-sm text-slate-800">{rec.recommended_user?.name}</p>
            <p className="text-xs text-slate-500">{rec.recommended_user?.institution}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-indigo-600">{Math.round(rec.score * 100)}%</p>
          <p className="text-xs text-slate-400">match</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        {rec.common_topics?.slice(0, 4).map(t => <Badge key={t} color="indigo">{t}</Badge>)}
      </div>
      <ul className="space-y-0.5 mb-3">
        {rec.reasons?.slice(0, 2).map((r, i) => (
          <li key={i} className="text-xs text-slate-600 flex gap-2">
            <Sparkles size={10} className="text-indigo-400 shrink-0 mt-0.5" />{r}
          </li>
        ))}
      </ul>
      <Button size="xs" icon={UserPlus} onClick={() => setShowSend(true)} className="w-full justify-center">
        Send Request
      </Button>
      <Modal open={showSend} onClose={() => setShowSend(false)} title="Send Collaboration Request">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Send a request to <strong>{rec.recommended_user?.name}</strong></p>
          <Textarea rows={3} placeholder="Introduce yourself and your research idea..."
            value={msg} onChange={e => setMsg(e.target.value)} />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setShowSend(false)}>Cancel</Button>
            <Button onClick={() => sendMut.mutate()} loading={sendMut.isPending} icon={UserPlus}>Send</Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

export default function CollabPage() {
  const [tab, setTab] = useState('incoming');
  const qc = useQueryClient();

  const { data: incoming } = useQuery({ queryKey: ['incoming'], queryFn: () => collabAPI.getIncoming().then(r => r.data) });
  const { data: outgoing } = useQuery({ queryKey: ['outgoing'], queryFn: () => collabAPI.getOutgoing().then(r => r.data) });
  const { data: recs, isLoading: loadingRecs } = useQuery({
    queryKey: ['collab-recs'],
    queryFn: () => aiAPI.getCollabRecs().then(r => r.data),
    retry: false,
  });

  const respondMut = useMutation({
    mutationFn: ({ id, status }) => collabAPI.respond(id, status),
    onSuccess: () => { toast.success('Response sent'); qc.invalidateQueries(['incoming']); },
  });

  const TABS = [
    { key: 'incoming', label: `Incoming (${incoming?.filter(r => r.status==='pending').length ?? 0})` },
    { key: 'outgoing', label: `Outgoing (${outgoing?.length ?? 0})` },
    { key: 'ai',       label: '✨ AI Recommendations' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <SectionTitle subtitle="Manage collaboration requests and discover potential research partners">
        Collaborations
      </SectionTitle>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'incoming' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {!incoming?.length
            ? <EmptyState icon={Users} title="No incoming requests" description="Check back later!" />
            : incoming.map(r => (
                <RequestCard key={r.id} req={r} type="incoming"
                  onRespond={(id, status) => respondMut.mutate({ id, status })} />
              ))
          }
        </div>
      )}

      {tab === 'outgoing' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {!outgoing?.length
            ? <EmptyState icon={Users} title="No outgoing requests" />
            : outgoing.map(r => <RequestCard key={r.id} req={r} type="outgoing" />)
          }
        </div>
      )}

      {tab === 'ai' && (
        <AIResultBox loading={loadingRecs} title="✨ AI Collaborator Recommendations">
          {recs?.recommendations?.length > 0
            ? <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recs.recommendations.map((rec, i) => <CollabRecCard key={i} rec={rec} />)}
              </div>
            : <p className="text-sm text-slate-500">{recs?.message || 'Add research interests to your profile to get AI recommendations.'}</p>
          }
        </AIResultBox>
      )}
    </div>
  );
}
