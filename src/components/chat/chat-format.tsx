import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, formatDateTime } from '@/shared';

// Small pieces shared by the chat's list and thread.

/** The time of a message, 24-hour, India time (for example 14:30). */
export function chatTime(iso: string): string {
  return formatDateTime(iso).split(', ')[1] ?? '';
}

/** The day a message was sent, as the thread separates them (for example 28 Oct 2026). */
export const chatDay = (iso: string): string => formatDate(iso);

/** A file size as people read it. */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (
    (words[0]?.[0] ?? '') + (words.length > 1 ? (words.at(-1)?.[0] ?? '') : '')
  ).toUpperCase();
}

/** A person's initials, or a group's icon, in a circle. */
export function ChatAvatar({
  name,
  group = false,
  className,
}: {
  name: string;
  group?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold',
        group ? 'bg-accent-soft text-accent-strong' : 'bg-primary-soft text-primary',
        className,
      )}
    >
      {group ? <Users className="size-4" /> : initials(name) || '?'}
    </span>
  );
}
