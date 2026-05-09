import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { projectsAPI } from '../api/client';
import { PageLoader } from '../components/Shared/UI';

export default function JoinProjectPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const joinMut = useMutation({
    mutationFn: () => projectsAPI.join(id),
    onSuccess: (res) => {
      if (res.data?.message === "Already a member") {
        toast.success("You are already a member of this workspace.");
      } else {
        toast.success("Successfully joined the workspace!");
        qc.invalidateQueries(['projects']);
      }
      navigate(`/projects/${id}`);
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Failed to join project. Invalid link or unauthorized.");
      navigate('/dashboard');
    }
  });

  useEffect(() => {
    if (id) {
      joinMut.mutate();
    } else {
      navigate('/dashboard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      <PageLoader />
      <p className="mt-4 text-slate-600 font-medium animate-pulse">Joining workspace...</p>
    </div>
  );
}
