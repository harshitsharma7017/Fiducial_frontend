import { formatDateTime } from '@/shared';
import type { Proposal } from '@/types/proposal';
import { Section } from './section-heading';

const MAX_EVENTS = 5;

/** The last five activity events, newest first, each with its time and who did it. */
export function ActivitySection({ proposal }: { proposal: Proposal }) {
  const events = [...proposal.activity]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, MAX_EVENTS);

  return (
    <Section title="Activity">
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
      ) : (
        <ol className="grid gap-3">
          {events.map((event, index) => (
            <li key={`${event.at}-${index}`} className="grid gap-0.5 border-l-2 border-border pl-3">
              <p className="text-sm">{event.message}</p>
              <p className="text-xs text-muted-foreground tabular">
                {formatDateTime(event.at)} · {event.actor}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
