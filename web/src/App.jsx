import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { ScreenLoader } from './components/ui.jsx';
import AppShell from './components/AppShell.jsx';

import Login from './screens/Login.jsx';
import JoinTable from './screens/JoinTable.jsx';
import Home from './screens/Home.jsx';
import Subjects from './screens/Subjects.jsx';
import CourseDetail from './screens/CourseDetail.jsx';
import OriginalNotes from './screens/OriginalNotes.jsx';
import Capsule from './screens/Capsule.jsx';
import ReviewSession from './screens/ReviewSession.jsx';
import AddNotes from './screens/AddNotes.jsx';
import Analyzing from './screens/Analyzing.jsx';
import Validation from './screens/Validation.jsx';
import MissedWhat from './screens/MissedWhat.jsx';
import CalendarScreen from './screens/CalendarScreen.jsx';
import GroupChat from './screens/GroupChat.jsx';
import NotificationsScreen from './screens/Notifications.jsx';
import Profile from './screens/Profile.jsx';
import CumulativeSummary from './screens/CumulativeSummary.jsx';

function Guard({ need = 'auth', children }) {
  const { user, group, loading } = useAuth();
  if (loading) return <ScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (need === 'group' && !group) return <Navigate to="/join" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={loading ? <ScreenLoader /> : user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/join"
        element={
          <Guard>
            <JoinTable />
          </Guard>
        }
      />
      <Route
        element={
          <Guard need="group">
            <AppShell />
          </Guard>
        }
      >
        <Route index element={<Home />} />
        <Route path="subjects" element={<Subjects />} />
        <Route path="courses/:id" element={<CourseDetail />} />
        <Route path="courses/:id/original" element={<OriginalNotes />} />
        <Route path="courses/:id/capsule" element={<Capsule />} />
        <Route path="courses/:id/analyzing" element={<Analyzing />} />
        <Route path="courses/:id/validate" element={<Validation />} />
        <Route path="review" element={<ReviewSession />} />
        <Route path="add-notes" element={<AddNotes />} />
        <Route path="missed" element={<MissedWhat />} />
        <Route path="calendar" element={<CalendarScreen />} />
        <Route path="chat" element={<GroupChat />} />
        <Route path="summary" element={<CumulativeSummary />} />
        <Route path="notifications" element={<NotificationsScreen />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
