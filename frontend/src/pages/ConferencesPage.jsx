/**
 * pages/ConferencesPage.jsx
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient }  from '@tanstack/react-query';
import { Calendar, Award, Globe, Filter, Plus } from 'lucide-react';
import { format } from 'date-fns';
import {
  Card, CardBody, Badge, Button, PageLoader, EmptyState, SectionTitle,
  Modal, Input
} from '../components/Shared/UI';
import { venuesAPI } from '../api/client';

function VenueCard({ item, type }) {
  const isConf    = type === 'conference';
  const urgency   = isConf && item.days_remaining <= 7   ? 'red'
                  : isConf && item.days_remaining <= 30  ? 'yellow' : 'green';
  return (
    <Card className="p-4 h-full flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="font-semibold text-slate-800 text-sm leading-snug">{item.name}</p>
          {item.abbreviation && <p className="text-xs text-indigo-600 font-mono">{item.abbreviation}</p>}
        </div>
        {item.ranking && <Badge color="indigo">{item.ranking}</Badge>}
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        {(item.research_areas || []).slice(0,3).map(a => <Badge key={a} color="default">{a}</Badge>)}
      </div>
      <div className="mt-auto space-y-1 text-xs text-slate-500">
        {isConf && item.submission_deadline && (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1"><Calendar size={11} />Deadline</span>
            <span className={`font-semibold text-${urgency}-600`}>
              {format(new Date(item.submission_deadline), 'MMM d, yyyy')}
              {item.days_remaining > 0 && ` (${item.days_remaining}d)`}
            </span>
          </div>
        )}
        {item.acceptance_rate && (
          <div className="flex items-center justify-between">
            <span>Accept rate</span>
            <span>{Math.round(item.acceptance_rate * 100)}%</span>
          </div>
        )}
        {item.impact_factor && (
          <div className="flex items-center justify-between">
            <span>Impact Factor</span>
            <span className="font-semibold text-slate-700">{item.impact_factor}</span>
          </div>
        )}
        {item.location && (
          <div className="flex items-center gap-1"><Globe size={11} />{item.location}</div>
        )}
      </div>
    </Card>
  );
}

export default function ConferencesPage() {
  const [tab, setTab]     = useState('conferences');
  const [search, setSearch] = useState('');
  const [upcoming, setUpcoming] = useState(false);

  const { data: confs, isLoading: lc } = useQuery({
    queryKey: ['conferences', search, upcoming],
    queryFn: () => venuesAPI.listConferences({ search: search||undefined, upcoming, limit:20 }).then(r => r.data),
  });
  const { data: journals, isLoading: lj } = useQuery({
    queryKey: ['journals', search],
    queryFn: () => venuesAPI.listJournals({ search: search||undefined, limit:20 }).then(r => r.data),
    enabled: tab === 'journals',
  });

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <SectionTitle subtitle="Browse conferences and journals for paper submission" action={
        <AddConferenceModal />
      }>
        Venues & Conferences
      </SectionTitle>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {['conferences','journals'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab===t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>
        <input className="flex-1 min-w-40 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder={`Search ${tab}...`} value={search} onChange={e => setSearch(e.target.value)} />
        {tab === 'conferences' && (
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={upcoming} onChange={e => setUpcoming(e.target.checked)}
              className="rounded" />
            Upcoming only
          </label>
        )}
      </div>

      {tab === 'conferences' && (
        lc ? <PageLoader /> :
        !confs?.items?.length ? <EmptyState icon={Calendar} title="No conferences found" /> :
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {confs.items.map(c => <VenueCard key={c.id} item={c} type="conference" />)}
        </div>
      )}
      {tab === 'journals' && (
        lj ? <PageLoader /> :
        !journals?.items?.length ? <EmptyState icon={Award} title="No journals found" /> :
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {journals.items.map(j => <VenueCard key={j.id} item={j} type="journal" />)}
        </div>
      )}
    </div>
  );
}

function AddConferenceModal() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [abbrev, setAbbrev] = useState('');
  const [deadline, setDeadline] = useState('');
  const [location, setLocation] = useState('');
  const [areas, setAreas] = useState('');
  const [error, setError] = useState('');

  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (data) => venuesAPI.createConference(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conferences'] });
      setOpen(false);
      setName('');
      setAbbrev('');
      setDeadline('');
      setLocation('');
      setAreas('');
      setError('');
    },
    onError: (err) => {
      setError(err.response?.data?.detail || 'Failed to create conference');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Conference name is required');
      return;
    }
    const payload = {
      name: name.trim(),
      abbreviation: abbrev.trim() || undefined,
      submission_deadline: deadline ? new Date(deadline).toISOString() : undefined,
      location: location.trim() || undefined,
      research_areas: areas
        ? areas.split(',').map((a) => a.trim()).filter(Boolean)
        : undefined,
    };
    mutation.mutate(payload);
  };

  return (
    <>
      <Button variant="secondary" size="sm" icon={Plus} onClick={() => setOpen(true)}>
        Add Conference
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add Conference" maxWidth="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
          <Input
            label="Conference Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., NeurIPS 2026"
            required
          />
          <Input
            label="Abbreviation"
            value={abbrev}
            onChange={(e) => setAbbrev(e.target.value)}
            placeholder="e.g., NeurIPS"
          />
          <Input
            label="Submission Deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
          <Input
            label="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g., Barcelona, Spain"
          />
          <Input
            label="Research Areas"
            value={areas}
            onChange={(e) => setAreas(e.target.value)}
            placeholder="e.g., AI, Machine Learning, NLP (comma separated)"
          />
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} type="button">
              Cancel
            </Button>
            <Button size="sm" loading={mutation.isPending} type="submit">
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
