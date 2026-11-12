import Pusher from 'pusher';

export const pusher = new Pusher({
  appId: (process.env.PUSHER_APP_ID || '').trim(),
  key: (process.env.PUSHER_KEY || '').trim(),
  secret: (process.env.PUSHER_SECRET || '').trim(),
  cluster: (process.env.PUSHER_CLUSTER || 'ap1').trim(),
  useTLS: true,
});

export default pusher;
