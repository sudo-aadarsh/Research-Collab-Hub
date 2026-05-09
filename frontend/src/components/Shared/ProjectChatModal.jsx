import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal, Button, Textarea, PageLoader } from './UI';
import { projectsAPI } from '../../api/client';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store';

export default function ProjectChatModal({ open, onClose, project }) {
  const [msg, setMsg] = useState('');
  const messagesEndRef = useRef(null);
  const qc = useQueryClient();
  const { user } = useAuthStore();

  const { data: messages, isLoading } = useQuery({
    queryKey: ['project-messages', project?.id],
    queryFn: () => projectsAPI.getMessages(project.id).then(r => r.data),
    enabled: !!project?.id && open,
    refetchInterval: 5000, // Poll every 5s for new messages
  });

  const sendMut = useMutation({
    mutationFn: () => projectsAPI.postMessage(project.id, { message: msg }),
    onSuccess: () => {
      setMsg('');
      qc.invalidateQueries(['project-messages', project.id]);
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed to send message'),
  });

  const handleSend = () => {
    if (!msg.trim()) return;
    sendMut.mutate();
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <Modal open={open} onClose={onClose} title={`Chat: ${project?.title || ''}`}>
      <div className="flex flex-col h-[60vh]">
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 rounded-lg mb-4">
          {isLoading ? (
            <PageLoader />
          ) : !messages?.length ? (
            <p className="text-center text-slate-500 text-sm mt-10">No messages yet. Say hi!</p>
          ) : (
            messages.map((m) => {
              const isMe = m.user_id === user?.id;
              return (
                <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-xs text-slate-500 mb-1 px-1">{isMe ? 'You' : m.user_name}</span>
                  <div className={`px-4 py-2 rounded-2xl max-w-[80%] ${
                    isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
                  }`}>
                    {m.message}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="flex gap-2">
          <Textarea 
            className="flex-1 min-h-[44px] max-h-[120px]" 
            rows={1}
            placeholder="Type a message..." 
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button onClick={handleSend} loading={sendMut.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6">
            Send
          </Button>
        </div>
      </div>
    </Modal>
  );
}
