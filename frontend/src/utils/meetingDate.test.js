import { sortMeetingsByProximity } from './meetingDate';

describe('sortMeetingsByProximity', () => {
  const referenceDate = new Date(2026, 9, 9, 12);

  it('orders upcoming meetings before past meetings by proximity', () => {
    const meetings = [
      { id: 'past-far', fecha: '2026-10-05', hora: '09:00' },
      { id: 'future-far', fecha: '2026-10-12', hora: '09:00' },
      { id: 'past-close', fecha: '2026-10-09', hora: '08:00' },
      { id: 'future-close', fecha: '2026-10-09', hora: '13:00' }
    ];

    expect(sortMeetingsByProximity(meetings, referenceDate).map(meeting => meeting.id)).toEqual([
      'future-close',
      'future-far',
      'past-close',
      'past-far'
    ]);
  });

  it('keeps entries with invalid dates at the end and does not mutate the source', () => {
    const meetings = [
      { id: 'invalid', fecha: 'not-a-date' },
      { id: 'invalid-time', fecha: '2026-10-10', hora: '27:00' },
      { id: 'valid', fecha: '2026-10-10', hora: '09:00' }
    ];

    expect(sortMeetingsByProximity(meetings, referenceDate).map(meeting => meeting.id)).toEqual([
      'valid',
      'invalid',
      'invalid-time'
    ]);
    expect(meetings[0].id).toBe('invalid');
  });
});
