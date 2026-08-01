import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus;
}

function parseLocalDate(dateValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day, 9, 0, 0, 0);
}

export async function scheduleFinanceReminder(vehicleId: string, vehicleName: string, dueDate: string, amount: number) {
  const notificationIds: string[] = [];
  const now = new Date();
  const dueDateObj = parseLocalDate(dueDate);

  if (!dueDateObj || dueDateObj <= now) {
    return notificationIds;
  }

  const title = `Upcoming payment for ${vehicleName}`;
  const body = `Your installment of Rs. ${amount.toLocaleString()} is due on ${dueDate}.`;

  const dueDateTrigger = new Date(dueDateObj);
  if (dueDateTrigger > now) {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { vehicleId, type: 'finance_reminder', exactDate: dueDate },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: dueDateTrigger },
    });
    notificationIds.push(id);
  }

  const beforeDate = new Date(dueDateObj);
  beforeDate.setDate(beforeDate.getDate() - 3);
  if (beforeDate > now) {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { vehicleId, type: 'finance_reminder_advance', exactDate: dueDate },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: beforeDate },
    });
    notificationIds.push(id);
  }

  return notificationIds;
}

export async function cancelFinanceReminder(notificationId?: string) {
  if (!notificationId) return;

  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.log('Error canceling notification:', notificationId, error);
  }
}

export async function cancelFinanceReminders(notificationIds?: string[]) {
  if (!notificationIds || !Array.isArray(notificationIds)) return;

  for (const id of notificationIds) {
    await cancelFinanceReminder(id);
  }
}
