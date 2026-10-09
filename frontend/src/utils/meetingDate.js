const getMeetingTimestamp = meeting => {
  const date = String(meeting?.fecha || '').slice(0, 10);
  const time = String(meeting?.hora || '00:00').slice(0, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;

  const parsedDate = new Date(`${date}T${time}`);
  if (!Number.isFinite(parsedDate.getTime())
    || parsedDate.getFullYear() !== Number(date.slice(0, 4))
    || parsedDate.getMonth() + 1 !== Number(date.slice(5, 7))
    || parsedDate.getDate() !== Number(date.slice(8, 10))
    || parsedDate.getHours() !== Number(time.slice(0, 2))
    || parsedDate.getMinutes() !== Number(time.slice(3, 5))) {
    return null;
  }
  return parsedDate.getTime();
};

export const sortMeetingsByProximity = (meetings, referenceDate = new Date()) => {
  const now = referenceDate.getTime();
  return (meetings || [])
    .map((meeting, index) => ({ meeting, index, timestamp: getMeetingTimestamp(meeting) }))
    .sort((left, right) => {
      if (left.timestamp === null || right.timestamp === null) {
        if (left.timestamp === right.timestamp) return left.index - right.index;
        return left.timestamp === null ? 1 : -1;
      }

      const leftIsUpcoming = left.timestamp >= now;
      const rightIsUpcoming = right.timestamp >= now;
      if (leftIsUpcoming !== rightIsUpcoming) return leftIsUpcoming ? -1 : 1;
      if (left.timestamp === right.timestamp) return left.index - right.index;
      return leftIsUpcoming
        ? left.timestamp - right.timestamp
        : right.timestamp - left.timestamp;
    })
    .map(item => item.meeting);
};
