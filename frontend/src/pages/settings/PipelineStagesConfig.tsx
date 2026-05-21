import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import apiClient from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

interface PipelineStage {
  id: string;
  label: string;
  order: number;
  color: string;
  emailTemplateId?: string | null;
}

const COLORS = ['#6366f1', '#f59e0b', '#3b82f6', '#10b981', '#22c55e', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function PipelineStagesConfig() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<PipelineStage[]>({
    queryKey: ['pipelineStages'],
    queryFn: () => apiClient.get('/companies/pipeline-stages').then(r => r.data.data),
  });

  const [stages, setStages] = useState<PipelineStage[] | null>(null);

  if (data && !stages) setStages([...data]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const mutation = useMutation({
    mutationFn: (s: PipelineStage[]) =>
      apiClient.put('/companies/pipeline-stages', { stages: s }),
    onSuccess: () => {
      toast.success('Pipeline stages saved');
      queryClient.invalidateQueries({ queryKey: ['pipelineStages'] });
      queryClient.invalidateQueries({ queryKey: ['companySettings'] });
    },
    onError: () => toast.error('Failed to save pipeline stages'),
  });

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !stages) return;
    const oldIdx = stages.findIndex(s => s.id === active.id);
    const newIdx = stages.findIndex(s => s.id === over.id);
    const reordered = arrayMove(stages, oldIdx, newIdx).map((s, i) => ({ ...s, order: i }));
    setStages(reordered);
  };

  const addStage = () => {
    if (!stages) return;
    const newStage: PipelineStage = {
      id: `stage_${Date.now()}`,
      label: '',
      order: stages.length,
      color: COLORS[stages.length % COLORS.length],
    };
    setStages([...stages, newStage]);
  };

  const removeStage = (id: string) => {
    if (!stages) return;
    setStages(stages.filter(s => s.id !== id).map((s, i) => ({ ...s, order: i })));
  };

  const updateStage = (id: string, field: keyof PipelineStage, value: string) => {
    if (!stages) return;
    setStages(stages.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  if (isLoading) return <div className="animate-pulse h-64 bg-neutral-100 rounded-xl" />;

  return (
    <div className="card p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Pipeline Stages</h2>
        <p className="text-sm text-warning-600 mt-1">⚠️ Changing stages affects all active jobs in this company.</p>
      </div>

      {stages && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={stages.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {stages.map((stage) => (
                <SortableStageRow
                  key={stage.id}
                  stage={stage}
                  onUpdate={updateStage}
                  onRemove={removeStage}
                  canRemove={stages.length > 1}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="flex items-center justify-between pt-2">
        <button onClick={addStage} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
          + Add Stage
        </button>
        <Button onClick={() => stages && mutation.mutate(stages)} disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving...' : 'Save Pipeline'}
        </Button>
      </div>
    </div>
  );
}

function SortableStageRow({
  stage, onUpdate, onRemove, canRemove,
}: {
  stage: PipelineStage;
  onUpdate: (id: string, field: keyof PipelineStage, value: string) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: stage.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 bg-neutral-50 rounded-lg px-3 py-2 border border-neutral-200">
      {/* Drag handle */}
      <button {...attributes} {...listeners} className="cursor-grab text-neutral-400 hover:text-neutral-600">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 2a2 2 0 100 4 2 2 0 000-4zm6 0a2 2 0 100 4 2 2 0 000-4zM7 8a2 2 0 100 4 2 2 0 000-4zm6 0a2 2 0 100 4 2 2 0 000-4zM7 14a2 2 0 100 4 2 2 0 000-4zm6 0a2 2 0 100 4 2 2 0 000-4z" />
        </svg>
      </button>

      {/* Color picker */}
      <input
        type="color"
        value={stage.color}
        onChange={e => onUpdate(stage.id, 'color', e.target.value)}
        className="w-6 h-6 rounded border border-neutral-200 cursor-pointer"
      />

      {/* Label */}
      <Input
        value={stage.label}
        onChange={e => onUpdate(stage.id, 'label', e.target.value)}
        placeholder="Stage name"
        className="flex-1"
      />

      {/* Delete */}
      {canRemove && (
        <button onClick={() => onRemove(stage.id)} className="text-neutral-400 hover:text-error-600 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
