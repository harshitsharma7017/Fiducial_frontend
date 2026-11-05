'use client';

import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Field } from './eb-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
  COVER_CHOICES,
  COVER_CHOICE_LABELS,
  GPA_COVERS,
  GPA_COVER_LABELS,
  MAX_CUSTOM_GPA_COVERS,
  type CoverChoice,
  type GpaCover,
  type GpaCustomCover,
} from '@/shared';

export interface GpaCoversValue {
  covers: Record<GpaCover, CoverChoice | null>;
  removedCovers: GpaCover[];
  customCovers: GpaCustomCover[];
}

function ChoiceSelect({
  value,
  disabled,
  label,
  onChange,
}: {
  value: CoverChoice | null;
  disabled: boolean;
  label: string;
  onChange: (value: CoverChoice | null) => void;
}) {
  return (
    <NativeSelect
      aria-label={label}
      disabled={disabled}
      value={value ?? ''}
      onChange={(event) => onChange((event.target.value || null) as CoverChoice | null)}
    >
      <option value="">Not chosen</option>
      {COVER_CHOICES.map((choice) => (
        <option key={choice} value={choice}>
          {COVER_CHOICE_LABELS[choice]}
        </option>
      ))}
    </NativeSelect>
  );
}

/** A short id for an added cover, unique on the case. */
function newCoverId(existing: readonly GpaCustomCover[]): string {
  const taken = new Set(existing.map((cover) => cover.id));
  for (let index = existing.length + 1; ; index += 1) {
    const id = `c${index}`;
    if (!taken.has(id)) return id;
  }
}

/**
 * The GPA covers (alteration 3/11/2026): each standard cover can be deleted (and brought back), and
 * the user adds covers of their own, each with Required / Not required and the limit asked for.
 * Deleting Temporary total disablement clears its weekly benefit (`onTemporaryTotalCleared`).
 */
export function GpaCoversEditor({
  value,
  disabled,
  errors,
  onChange,
  onTemporaryTotalCleared,
}: {
  value: GpaCoversValue;
  disabled: boolean;
  errors: Record<string, string>;
  onChange: (value: GpaCoversValue) => void;
  onTemporaryTotalCleared: () => void;
}) {
  const removed = new Set(value.removedCovers);
  const remove = (cover: GpaCover) => {
    onChange({
      ...value,
      covers: { ...value.covers, [cover]: null },
      removedCovers: [...value.removedCovers, cover],
    });
    if (cover === 'temporaryTotal') onTemporaryTotalCleared();
  };
  const restore = (cover: GpaCover) =>
    onChange({ ...value, removedCovers: value.removedCovers.filter((item) => item !== cover) });
  const setCustom = (index: number, patch: Partial<GpaCustomCover>) =>
    onChange({
      ...value,
      customCovers: value.customCovers.map((cover, at) =>
        at === index ? { ...cover, ...patch } : cover,
      ),
    });
  const error = (path: string) =>
    errors[path] ? <p className="text-xs text-destructive">{errors[path]}</p> : null;

  return (
    <div className="grid gap-3 sm:col-span-2">
      <ul className="grid gap-3" aria-label="Covers">
        {GPA_COVERS.filter((cover) => !removed.has(cover)).map((cover) => (
          <li key={cover} className="grid items-end gap-2 sm:grid-cols-[1fr_14rem_auto]">
            <span className="text-sm">{GPA_COVER_LABELS[cover]}</span>
            <ChoiceSelect
              label={GPA_COVER_LABELS[cover]}
              disabled={disabled}
              value={value.covers[cover]}
              onChange={(choice) => {
                onChange({ ...value, covers: { ...value.covers, [cover]: choice } });
                if (cover === 'temporaryTotal' && choice !== 'REQUIRED') onTemporaryTotalCleared();
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              aria-label={`Delete ${GPA_COVER_LABELS[cover]}`}
              onClick={() => remove(cover)}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </li>
        ))}
        {value.customCovers.map((cover, index) => (
          <li
            key={cover.id}
            className="grid items-end gap-2 sm:grid-cols-[1fr_14rem_auto]"
            aria-label={cover.name || 'New cover'}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Cover name">
                <Input
                  maxLength={120}
                  disabled={disabled}
                  value={cover.name}
                  onChange={(event) => setCustom(index, { name: event.target.value })}
                />
                {error(`customCovers.${index}.name`)}
              </Field>
              <Field label="Limit asked for (optional)">
                <Input
                  maxLength={200}
                  disabled={disabled}
                  value={cover.limit ?? ''}
                  onChange={(event) => setCustom(index, { limit: event.target.value || null })}
                />
              </Field>
            </div>
            <ChoiceSelect
              label={`${cover.name || 'New cover'}: required or not`}
              disabled={disabled}
              value={cover.choice}
              onChange={(choice) => setCustom(index, { choice })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              aria-label={`Delete ${cover.name || 'the new cover'}`}
              onClick={() =>
                onChange({
                  ...value,
                  customCovers: value.customCovers.filter((_, at) => at !== index),
                })
              }
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
      {error('customCovers')}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || value.customCovers.length >= MAX_CUSTOM_GPA_COVERS}
          onClick={() =>
            onChange({
              ...value,
              customCovers: [
                ...value.customCovers,
                { id: newCoverId(value.customCovers), name: '', choice: null, limit: null },
              ],
            })
          }
        >
          <Plus aria-hidden="true" />
          Add cover
        </Button>
        {value.removedCovers.map((cover) => (
          <Button
            key={cover}
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => restore(cover)}
          >
            <RotateCcw aria-hidden="true" />
            Restore {GPA_COVER_LABELS[cover]}
          </Button>
        ))}
      </div>
    </div>
  );
}
