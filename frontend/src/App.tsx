import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import RequireAuth from './components/RequireAuth';
import Home from './pages/Home';
import Chat from './pages/Chat';
import GroupChat from './pages/GroupChat';
import GroupList from './pages/GroupList';
import CharacterEdit from './pages/CharacterEdit';
import CharacterDetail from './pages/CharacterDetail';
import GroupEdit from './pages/GroupEdit';
import CharacterExtras from './pages/CharacterExtras';
import Login from './pages/Login';
import Signup from './pages/Signup';
import UserProfile from './pages/UserProfile';
import UserProfileSetup from './pages/UserProfileSetup';
import Memories from './pages/Memories';
import './App.css';

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<Home />} />
            <Route path="/profile" element={<UserProfile />} />
            <Route path="/profile/setup" element={<UserProfileSetup />} />
            <Route path="/chat/:characterId" element={<Chat />} />
            <Route path="/group" element={<GroupList />} />
            <Route path="/group/:groupId" element={<GroupChat />} />
            <Route path="/character/:characterId" element={<CharacterDetail />} />
            <Route path="/character/new" element={<CharacterEdit />} />
            <Route path="/character/:characterId/edit" element={<CharacterEdit />} />
            <Route path="/character/:characterId/extras" element={<CharacterExtras />} />
            <Route path="/character/:characterId/memories" element={<Memories />} />
            <Route path="/group/new" element={<GroupEdit />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
