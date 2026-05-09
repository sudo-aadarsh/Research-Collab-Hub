import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { papersAPI } from '../api/client';
import { PageLoader } from '../components/Shared/UI';

export default function JoinPaperPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const joinMut = useMutation({
    mutationFn: () => papersAPI.join(id),
    onSuccess: (res) => {
      if (res.data?.message === "Already an author") {
        toast.success("You are already collaborating on this paper.");
      } else {
        toast.success("Successfully joined the paper!");
        qc.invalidateQueries(['papers']);
      }
      navigate(`/papers/${id}`);
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Failed to join paper. Invalid link or unauthorized.");
      navigate('/collaborations');
    }
  });

  useEffect(() => {
    if (id) {
      joinMut.mutate();
    } else {
      navigate('/collaborations');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      <PageLoader />
      <p className="mt-4 text-slate-600 font-medium animate-pulse">Joining paper collaboration...</p>
    </div>
  );
}
