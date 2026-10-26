import { Redirect } from 'expo-router';

// Reports were folded into Insights (38-home-insights-more.md). The route
// stays only so send-push's "report ready" notification (data.route
// '/report') and any old link still land somewhere real.
export default function Report() {
  return <Redirect href="/insights" />;
}
