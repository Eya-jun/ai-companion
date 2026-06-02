import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Chat from './pages/Chat';
import GroupChat from './pages/GroupChat';
import CharacterEdit from './pages/CharacterEdit';
import GroupEdit from './pages/GroupEdit';
import CharacterExtras from './pages/CharacterExtras';
import './App.css';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/chat/:characterId" element={<Chat />} />
        <Route path="/group/:groupId" element={<GroupChat />} />
        <Route path="/character/new" element={<CharacterEdit />} />
        <Route path="/character/:characterId/edit" element={<CharacterEdit />} />
        <Route path="/character/:characterId/extras" element={<CharacterExtras />} />
        <Route path="/group/new" element={<GroupEdit />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
