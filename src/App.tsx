import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import TokenLabApp from './components/TokenLabApp'
import AdvancedTokenDeployer from './components/AdvancedTokenDeployer'
import './App.css'

function App() {
  return (
    <div className="App">
      <Router>
        <Routes>
          <Route path="/" element={<TokenLabApp />} />
          <Route path="/advanced" element={<AdvancedTokenDeployer />} />
        </Routes>
      </Router>
    </div>
  )
}

export default App