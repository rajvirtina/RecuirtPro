import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { useAuthStore } from '../../../store/authStore';
import apiClient from '../../../services/api';
import { Avatar } from '../../../components/ui/Avatar';
import { Button } from '../../../components/ui/Button';

interface Note {
  _id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

interface NotesResponse {
  data: Note[];
  pagination: { total: number; page: number; pages: number };
}

export function NotesTab({ applicationId }: { applicationId: string }) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data, isLoading } = useQuery<NotesResponse>({
    queryKey: ['notes', applicationId],
    queryFn: () => apiClient.get(`/applications/${applicationId}/notes`).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (noteContent: string) =>
      apiClient.post(`/applications/${applicationId}/notes`, { content: noteContent }).then(r => r.data),
    onMutate: async (noteContent) => {
      await queryClient.cancelQueries({ queryKey: ['notes', applicationId] });
      const previous = queryClient.getQueryData<NotesResponse>(['notes', applicationId]);
      const optimistic: Note = {
        _id: `temp-${Date.now()}`,
        authorId: user?._id || '',
        authorName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
        content: noteContent,
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<NotesResponse>(['notes', applicationId], (old) => ({
        data: [optimistic, ...(old?.data || [])],
        pagination: old?.pagination || { total: 0, page: 1, pages: 1 },
      }));
      setContent('');
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['notes', applicationId], context.previous);
      }
      toast.error('Failed to add note');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', applicationId] });
      queryClient.invalidateQueries({ queryKey: ['timeline', applicationId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (noteId: string) =>
      apiClient.delete(`/applications/${applicationId}/notes/${noteId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', applicationId] });
      toast.success('Note deleted');
    },
    onError: () => toast.error('Failed to delete note'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    createMutation.mutate(content.trim());
  };

  const notes = data?.data || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Compose */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, 2000))}
            placeholder="Add a note about this candidate..."
            rows={3}
            className="field-input resize-none"
          />
          <span className="absolute bottom-2 right-3 text-xs text-neutral-400">
            {content.length} / 2000
          </span>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={!content.trim() || createMutation.isPending}>
            {createMutation.isPending ? 'Adding...' : 'Add Note'}
          </Button>
        </div>
      </form>

      {/* Notes list */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse flex gap-3">
              <div className="w-8 h-8 bg-neutral-200 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-neutral-200 rounded w-1/4" />
                <div className="h-3 bg-neutral-200 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : notes.length === 0 ? (
        <p className="text-sm text-neutral-400 text-center py-8">No notes yet. Be the first to add one.</p>
      ) : (
        <ul className="space-y-4">
          {notes.map((note) => (
            <li key={note._id} className="flex gap-3 group">
              <Avatar name={note.authorName} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-neutral-900">{note.authorName}</span>
                  <span className="text-xs text-neutral-400">
                    {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-neutral-700 whitespace-pre-wrap mt-0.5">{note.content}</p>
              </div>
              {(note.authorId === user?._id || user?.role === 'admin' || user?.role === 'super_admin') && (
                <button
                  onClick={() => deleteMutation.mutate(note._id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-400 hover:text-error-600 p-1"
                  title="Delete note"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
