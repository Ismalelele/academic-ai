import { getSafeLocalStorage } from './storageSecurity';

export const getLocalDateString = (date = new Date()) => {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

const initializeStudyData = (userId) => {
  if (!userId) return {};
  const key = `academic_${userId}_study_minutes`;
  const saved = getSafeLocalStorage(key, userId, null);
  if (!saved) {
    // Check if the user has a schedule entered
    const scheduleKey = `academic_${userId}_schedule`;
    const scheduleStr = localStorage.getItem(scheduleKey);
    let hasSchedule = false;
    if (scheduleStr) {
      try {
        const parsed = JSON.parse(scheduleStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          hasSchedule = true;
        }
      } catch (e) {}
    }

    if (hasSchedule) {
      const mockData = {};
      const now = new Date();
      const currentDay = now.getDay();
      const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - distanceToMonday);
      
      // Some baseline study hours (in hours) to make the graph look alive initially
      const mockHours = [3.5, 4.8, 3.0, 5.5, 4.0, 2.5, 1.2];
      for (let i = 0; i < distanceToMonday; i++) {
        const dayDate = new Date(monday);
        dayDate.setDate(monday.getDate() + i);
        const dayStr = getLocalDateString(dayDate);
        mockData[dayStr] = Math.round(mockHours[i % mockHours.length] * 60);
      }
      localStorage.setItem(key, JSON.stringify(mockData));
      return mockData;
    } else {
      // User has no schedule yet, keep everything at 0
      return {};
    }
  }
  return saved;
};

export const addStudyMinutes = (userId, minutes) => {
  if (!userId) return;
  const key = `academic_${userId}_study_minutes`;
  const todayStr = getLocalDateString();
  
  const data = initializeStudyData(userId);
  data[todayStr] = (data[todayStr] || 0) + minutes;
  localStorage.setItem(key, JSON.stringify(data));
};

export const getWeeklyStudyHours = (userId) => {
  if (!userId) {
    return [0, 0, 0, 0, 0, 0, 0];
  }
  const data = initializeStudyData(userId);

  const now = new Date();
  const currentDay = now.getDay();
  const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - distanceToMonday);

  const weeklyHours = [];
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + i);
    const dayStr = getLocalDateString(dayDate);
    const minutes = data[dayStr] || 0;
    const hours = parseFloat((minutes / 60).toFixed(1));
    weeklyHours.push(hours);
  }
  return weeklyHours;
};

export const getHistoricalWeeklyAverage = (userId) => {
  if (!userId) return 0.0;
  const data = initializeStudyData(userId);
  const keys = Object.keys(data);
  if (keys.length === 0) return 0.0;
  
  // Group keys by week-starting-on-Monday
  const weeklySums = {};
  keys.forEach(dateStr => {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return;
    const day = d.getDay();
    const distanceToMonday = day === 0 ? 6 : day - 1;
    const monday = new Date(d);
    monday.setDate(d.getDate() - distanceToMonday);
    const mondayStr = monday.toISOString().split('T')[0];
    weeklySums[mondayStr] = (weeklySums[mondayStr] || 0) + data[dateStr];
  });

  const weeks = Object.keys(weeklySums);
  if (weeks.length === 0) return 0.0;
  
  const totalHours = weeks.reduce((sum, mon) => sum + (weeklySums[mon] / 60), 0);
  return parseFloat((totalHours / weeks.length).toFixed(1));
};
