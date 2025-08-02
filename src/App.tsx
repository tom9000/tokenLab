import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import TokenLabApp from './components/TokenLabApp'
import AdvancedTokenDeployer from './components/AdvancedTokenDeployer'
import { TokenDeployerAgent2 } from './components/TokenDeployerAgent2'
import './App.css'

function App() {
  return (
    <div className="App">
      <Router>
        <Routes>
          <Route path="/" element={<TokenLabApp />} />
          <Route path="/advanced" element={<AdvancedTokenDeployer />} />
          <Route path="/agent2" element={<TokenDeployerAgent2 />} />
        </Routes>
      </Router>
    </div>
  )
}

export default App