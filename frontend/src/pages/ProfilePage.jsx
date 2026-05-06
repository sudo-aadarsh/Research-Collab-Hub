/**
 * pages/ProfilePage.jsx
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Plus, X, BookOpen, Award } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Card, CardHeader, CardBody, Badge, Button, PageLoader,
  SectionTitle, Input, Modal, Select
} from '../components/Shared/UI';
import { usersAPI } from '../api/client';
import { useAuthStore } from '../store';

export function ProfilePage() {
  const { id }       = useParams();
  const { user: me, updateUser } = useAuthStore();
  const qc           = useQueryClient();
  const isOwn        = !id || id === me?.id;

  const [newInterest, setNewInterest] = useState('');
  const [newSkill,    setNewSkill]    = useState({ skill:'', level:'intermediate' });
  const [editBio,     setEditBio]     = useState(false);
  const [bioText,     setBioText]     = useState(me?.bio || '');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', id || me?.id],
    queryFn:  () => (isOwn ? usersAPI.getMe() : usersAPI.getUser(id)).then(r => r.data),
  });

  const addInterestMut = useMutation({
    mutationFn: () => usersAPI.addInterest({ topic: newInterest, weight: 1.0 }),
    onSuccess: () => { qc.invalidateQueries(['profile']); setNewInterest(''); toast.success('Interest added'); },
  });
  const removeInterestMut = useMutation({
    mutationFn: (topic) => usersAPI.removeInterest(topic),
    onSuccess: () => qc.invalidateQueries(['profile']),
  });
  const addSkillMut = useMutation({
    mutationFn: () => usersAPI.addSkill(newSkill),
    onSuccess: () => { qc.invalidateQueries(['profile']); setNewSkill({ skill:'', level:'intermediate' }); toast.success('Skill added'); },
  });
  const updateBioMut = useMutation({
    mutationFn: () => usersAPI.updateMe({ bio: bioText }),
    onSuccess: () => { qc.invalidateQueries(['profile']); updateUser({ bio: bioText }); setEditBio(false); toast.success('Bio updated'); },
  });

  if (isLoading) return <PageLoader />;
  const p = profile;
  const SKILL_COLORS = { beginner:'default', intermediate:'indigo', expert:'green' };
  const interests = (p?.interests || []).map((interest) =>
    typeof interest === 'string' ? { topic: interest } : interest
  );
  const skills = (p?.skills || []).map((skill) =>
    typeof skill === 'string' ? { skill } : skill
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <CardBody>
          <div className="flex items-start gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-500 text-white flex items-center justify-center text-3xl font-bold shrink-0">
              {p?.full_name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-slate-800">{p?.full_name}</h1>
              <p className="text-indigo-600 text-sm">@{p?.username}</p>
              {p?.institution && <p className="text-sm text-slate-500 mt-0.5">{p.institution} · {p.department}</p>}
              {p?.orcid_id && (
                <a href={`https://orcid.org/${p.orcid_id}`} target="_blank" rel="noreferrer"
                  className="text-xs text-emerald-600 hover:underline mt-0.5 block">
                  ORCID: {p.orcid_id}
                </a>
              )}
              <div className="flex items-center gap-3 mt-2">
                <Badge color="indigo">
                  <Award size={10} className="mr-1 inline" />H-index: {p?.h_index ?? 0}
                </Badge>
                <Badge color="default"><BookOpen size={10} className="mr-1 inline" />Researcher</Badge>
              </div>
            </div>
          </div>

          {/* Bio */}
          <div className="mt-4">
            {editBio ? (
              <div className="space-y-2">
                <textarea className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  rows={3} value={bioText} onChange={e => setBioText(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="xs" onClick={() => updateBioMut.mutate()} loading={updateBioMut.isPending}>Save</Button>
                  <Button size="xs" variant="secondary" onClick={() => setEditBio(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <p className="text-sm text-slate-600 flex-1">{p?.bio || 'No bio yet.'}</p>
                {isOwn && <Button size="xs" variant="ghost" onClick={() => { setBioText(p?.bio||''); setEditBio(true); }}>Edit</Button>}
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Research Interests */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-800">Research Interests</h3>
          </CardHeader>
          <CardBody>
            <div className="flex flex-wrap gap-2 mb-4">
              {interests.map(({ topic, weight }) => (
                <span key={topic} className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">
                  {topic}
                  {typeof weight === 'number' && <span className="text-indigo-400">({Math.round(weight * 100)}%)</span>}
                  {isOwn && (
                    <button onClick={() => removeInterestMut.mutate(topic)} className="hover:text-red-500 transition-colors ml-1">
                      <X size={10} />
                    </button>
                  )}
                </span>
              ))}
              {!interests.length && <p className="text-xs text-slate-400">No interests added</p>}
            </div>
            {isOwn && (
              <div className="flex gap-2">
                <input className="flex-1 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. deep learning" value={newInterest}
                  onChange={e => setNewInterest(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && newInterest && addInterestMut.mutate()} />
                <Button size="xs" icon={Plus} onClick={() => addInterestMut.mutate()} disabled={!newInterest}>Add</Button>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Skills */}
        <Card>
          <CardHeader><h3 className="font-semibold text-slate-800">Skills</h3></CardHeader>
          <CardBody>
            <div className="flex flex-wrap gap-2 mb-4">
              {skills.map(s => (
                <Badge key={s.skill} color={SKILL_COLORS[s.level] || 'default'}>
                  {s.skill} {s.level && `· ${s.level}`}
                </Badge>
              ))}
              {!skills.length && <p className="text-xs text-slate-400">No skills added</p>}
            </div>
            {isOwn && (
              <div className="flex gap-2 flex-wrap">
                <input className="flex-1 min-w-28 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Python, PyTorch..." value={newSkill.skill}
                  onChange={e => setNewSkill(s => ({...s, skill: e.target.value}))} />
                <select className="px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg"
                  value={newSkill.level} onChange={e => setNewSkill(s => ({...s, level: e.target.value}))}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="expert">Expert</option>
                </select>
                <Button size="xs" icon={Plus} onClick={() => addSkillMut.mutate()} disabled={!newSkill.skill}>Add</Button>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
export default ProfilePage;
