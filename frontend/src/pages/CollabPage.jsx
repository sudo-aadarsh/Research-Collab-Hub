import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, UserPlus, CheckCircle, XCircle, MessageSquare, Play, FolderKanban, Activity, Link as LinkIcon, FileText, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  Card, Badge, Button, PageLoader, EmptyState, SectionTitle, Modal, Textarea
} from '../components/Shared/UI';
import { collabAPI, projectsAPI, papersAPI } from '../api/client';
import { useAuthStore, useUIStore } from '../store';
import ProjectChatModal from '../components/Shared/ProjectChatModal';
import PaperChatModal from '../components/Shared/PaperChatModal';

function ActiveWorkspaceCard({ project, onOpenInvite }) {
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <>
      <Card className="p-5 border-l-4 border-l-emerald-500 hover:shadow-lg transition-all transform hover:-translate-y-1 bg-white flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 pr-4">
            <h3 className="font-bold text-slate-800 text-lg leading-tight mb-1">{project.title}</h3>
            <p className="text-sm text-slate-500 line-clamp-2">{project.description || 'No description provided.'}</p>
          </div>
          <Badge color="emerald" className="animate-pulse flex items-center gap-1.5 shrink-0 bg-emerald-100 text-emerald-700 border-emerald-200">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
            Live
          </Badge>
        </div>
        
        <div className="flex items-center gap-4 mt-4 mb-5 text-sm text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
          <span className="flex items-center gap-1.5 font-medium">
            <Users size={16} className="text-indigo-500"/> 
            {project.member_count || 1} Collaborators
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <Activity size={16} className="text-amber-500"/> 
            {project.milestone_completed || 0}/{project.milestone_total || 0} Tasks
          </span>
        </div>

        <div className="flex gap-2 mt-auto">
          <Button size="sm" className="flex-1 justify-center bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200" 
            onClick={() => navigate(`/projects/${project.id}`)}>
            <Play size={14} className="mr-1" /> Enter Workspace
          </Button>
          <Button size="sm" variant="secondary" className="px-3 border-slate-200 text-slate-600 hover:bg-slate-100" 
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/join/${project.id}`);
              toast.success('Invite link copied!');
            }} title="Copy Invite Link">
            <LinkIcon size={16} />
          </Button>
          <Button size="sm" variant="secondary" className="px-3 border-slate-200 text-slate-600 hover:bg-slate-100" 
            onClick={() => setChatOpen(true)} title="Team Chat">
            <MessageSquare size={16} />
          </Button>
          <Button size="sm" variant="secondary" className="px-3 border-slate-200 text-slate-600 hover:bg-slate-100" 
            onClick={() => onOpenInvite({ type: 'project', id: project.id, title: project.title })} title="Invite Collaborator">
            <UserPlus size={16} />
          </Button>
        </div>
      </Card>
      
      <ProjectChatModal open={chatOpen} onClose={() => setChatOpen(false)} project={project} />
    </>
  );
}

function CollaborativePaperCard({ paper, onOpenInvite }) {
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);
  return (
    <>
      <Card className="p-5 border-l-4 border-l-indigo-500 hover:shadow-lg transition-all transform hover:-translate-y-1 bg-white flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 pr-4">
            <h3 className="font-bold text-slate-800 text-lg leading-tight mb-1">{paper.title}</h3>
            <p className="text-sm text-slate-500 line-clamp-2">{paper.abstract || 'No abstract provided.'}</p>
          </div>
          <Badge color="indigo" className="shrink-0">{paper.status}</Badge>
        </div>
        
        <div className="flex gap-2 mt-auto pt-5">
          <Button size="sm" className="flex-1 justify-center bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200" 
            onClick={() => navigate(`/papers/${paper.id}`)}>
            <FileText size={14} className="mr-1" /> View
          </Button>
          <Button size="sm" variant="secondary" className="px-3 border-slate-200 text-slate-600 hover:bg-slate-100" 
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/join-paper/${paper.id}`);
              toast.success('Paper link copied!');
            }} title="Copy Link">
            <LinkIcon size={16} />
          </Button>
          <Button size="sm" variant="secondary" className="px-3 border-slate-200 text-slate-600 hover:bg-slate-100" 
            onClick={() => setChatOpen(true)} title="Paper Chat">
            <MessageSquare size={16} />
          </Button>
          <Button size="sm" variant="secondary" className="px-3 border-slate-200 text-slate-600 hover:bg-slate-100" 
            onClick={() => onOpenInvite({ type: 'paper', id: paper.id, title: paper.title })} title="Invite Collaborator">
            <UserPlus size={16} />
          </Button>
        </div>
      </Card>
      
      <PaperChatModal open={chatOpen} onClose={() => setChatOpen(false)} paper={paper} />
    </>
  );
}

function RequestCard({ req, type, onRespond }) {
  const person = type === 'incoming' ? req.requester : req.target;
  const statusColors = { pending:'yellow', accepted:'green', declined:'red' };
  return (
    <Card className="p-4 border border-slate-100 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold shrink-0 shadow-inner">
            {person?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-sm text-slate-800">{person?.name}</p>
            <p className="text-xs text-slate-500">{person?.institution || 'Unknown Institution'}</p>
          </div>
        </div>
        <Badge color={statusColors[req.status] || 'default'}>{req.status}</Badge>
      </div>
      {req.message && (
        <div className="mt-3 bg-slate-50 border border-slate-100 rounded-lg p-3 relative">
          <MessageSquare size={14} className="absolute top-3 left-3 text-slate-300" />
          <p className="text-sm text-slate-600 pl-6 italic">"{req.message}"</p>
        </div>
      )}
      {type === 'incoming' && req.status === 'pending' && (
        <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
          <Button size="sm" className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white" icon={CheckCircle}
            onClick={() => onRespond(req.id, 'accepted')}>Accept</Button>
          <Button size="sm" className="flex-1 bg-rose-500 hover:bg-rose-600 text-white" icon={XCircle}
            onClick={() => onRespond(req.id, 'declined')}>Decline</Button>
        </div>
      )}
    </Card>
  );
}

export default function CollabPage() {
  const [tab, setTab] = useState('workspaces');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteTarget, setInviteTarget] = useState(null);
  const qc = useQueryClient();
  const { addNotification } = useUIStore();

  const { data: projectsData, isLoading: loadingProjects } = useQuery({
    queryKey: ['projects', 'workspaces'],
    queryFn: () => projectsAPI.list({ limit: 10 }).then(r => r.data),
  });
  
  const { data: papersData, isLoading: loadingPapers } = useQuery({
    queryKey: ['papers', 'workspaces'],
    queryFn: () => papersAPI.list({ limit: 10 }).then(r => r.data),
  });

  const { data: incoming } = useQuery({ queryKey: ['incoming'], queryFn: () => collabAPI.getIncoming().then(r => r.data) });
  const { data: outgoing } = useQuery({ queryKey: ['outgoing'], queryFn: () => collabAPI.getOutgoing().then(r => r.data) });

  const respondMut = useMutation({
    mutationFn: ({ id, status }) => collabAPI.respond(id, status),
    onSuccess: (_, { status }) => {
      toast.success('Response sent');
      qc.invalidateQueries(['incoming']);
      addNotification({
        type: 'collab',
        title: `Collaboration request ${status}`,
        message: `You ${status} a collaboration request.`
      });
    },
  });

  const inviteMut = useMutation({
    mutationFn: () => collabAPI.sendRequest({ 
      target_email: inviteEmail, 
      message: inviteMessage,
      project_id: inviteTarget?.type === 'project' ? inviteTarget.id : undefined,
      paper_id: inviteTarget?.type === 'paper' ? inviteTarget.id : undefined,
    }),
    onSuccess: () => {
      toast.success('Invitation sent!');
      addNotification({
        type: 'collab',
        title: 'Collaboration invite sent',
        message: `Invite sent to ${inviteEmail}${inviteTarget ? ` for "${inviteTarget.title}"` : ''}.`
      });
      closeInviteModal();
      qc.invalidateQueries(['outgoing']);
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed to send invitation'),
  });

  const openInviteModal = (target = null) => {
    setInviteTarget(target);
    setShowInviteModal(true);
  };

  const closeInviteModal = () => {
    setShowInviteModal(false);
    setInviteEmail('');
    setInviteMessage('');
    setInviteTarget(null);
  };

  const workspaces = projectsData?.items || [];
  const papers = papersData?.items || [];
  const pendingIncoming = incoming?.filter(r => r.status === 'pending').length || 0;

  const TABS = [
    { key: 'workspaces', label: 'Active Workspaces', icon: FolderKanban },
    { key: 'incoming', label: `Incoming Requests ${pendingIncoming > 0 ? `(${pendingIncoming})` : ''}`, icon: Users },
    { key: 'outgoing', label: 'Sent Requests', icon: MessageSquare },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <SectionTitle subtitle="Manage real-time collaborations, pending requests, and discover potential research partners.">
        Collaborations Hub
      </SectionTitle>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm w-fit">
        {TABS.map(t => {
          const Icon = t.icon;
          const isActive = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                isActive 
                  ? 'bg-slate-800 text-white shadow-md' 
                  : 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}>
              <Icon size={16} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content: Active Workspaces */}
      {tab === 'workspaces' && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Projects Section */}
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-6">
              <h2 className="text-xl font-bold text-emerald-900 mb-2 flex items-center gap-2">
                <Activity size={20} className="text-emerald-600" /> Live Project Workspaces
              </h2>
              <p className="text-emerald-700 text-sm">
                Enter a workspace to collaborate in real-time, view live edits, and chat with team members. 
              </p>
            </div>

            {loadingProjects ? <PageLoader /> :
             !workspaces.length ? (
               <EmptyState icon={FolderKanban} title="No active workspaces" description="Create a project to start collaborating with others." />
             ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
                 {workspaces.map(proj => (
                   <ActiveWorkspaceCard key={proj.id} project={proj} onOpenInvite={openInviteModal} />
                 ))}
               </div>
             )}
          </div>

          {/* Papers Section */}
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-6">
              <h2 className="text-xl font-bold text-indigo-900 mb-2 flex items-center gap-2">
                <FileText size={20} className="text-indigo-600" /> Collaborative Papers
              </h2>
              <p className="text-indigo-700 text-sm">
                View and edit papers you are collaborating on.
              </p>
            </div>

            {loadingPapers ? <PageLoader /> :
             !papers.length ? (
               <EmptyState icon={FileText} title="No collaborative papers" description="You don't have any papers yet." />
             ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
                 {papers.map(paper => (
                   <CollaborativePaperCard key={paper.id} paper={paper} onOpenInvite={openInviteModal} />
                 ))}
               </div>
             )}
          </div>

        </div>
      )}

      {/* Tab Content: Incoming */}
      {tab === 'incoming' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Users size={18} className="text-indigo-600" /> Pending Invitations
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {!incoming?.length
              ? <EmptyState icon={Users} title="No incoming requests" description="Check back later!" />
              : incoming.map(r => (
                  <RequestCard key={r.id} req={r} type="incoming"
                    onRespond={(id, status) => respondMut.mutate({ id, status })} />
                ))
            }
          </div>
        </div>
      )}

      {/* Tab Content: Outgoing */}
      {tab === 'outgoing' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <MessageSquare size={18} className="text-indigo-600" /> Sent Requests
            </h2>
            <Button size="sm" icon={Send} onClick={() => openInviteModal()} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Send Invite
            </Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {!outgoing?.length
              ? <EmptyState icon={MessageSquare} title="No outgoing requests" description="You haven't sent any collaboration requests yet." />
              : outgoing.map(r => <RequestCard key={r.id} req={r} type="outgoing" />)
            }
          </div>
        </div>
      )}

      {/* Global Invite Modal */}
      <Modal open={showInviteModal} onClose={closeInviteModal} title="Send Collaboration Invite">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {inviteTarget?.type === 'project' ? `Invite a researcher to collaborate on project: ${inviteTarget.title}` :
             inviteTarget?.type === 'paper' ? `Invite a researcher to collaborate on paper: ${inviteTarget.title}` :
             'Invite a researcher to collaborate by their email address.'}
          </p>
          
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">User Email <span className="text-red-500">*</span></label>
            <input type="email" placeholder="colleague@university.edu"
              className="w-full text-sm p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
              value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Message (Optional)</label>
            <Textarea rows={3} placeholder="Introduce yourself and your research idea..."
              value={inviteMessage} onChange={e => setInviteMessage(e.target.value)} className="w-full" />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" onClick={closeInviteModal}>Cancel</Button>
            <Button onClick={() => inviteMut.mutate()} loading={inviteMut.isPending} icon={Send} className="bg-indigo-600 hover:bg-indigo-700 text-white" disabled={!inviteEmail}>
              Send Invite
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
