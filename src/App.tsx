import React, { Suspense, lazy, useState, useEffect } from 'react';
import { Redirect, Route, useLocation } from 'react-router-dom';
import {
  IonApp,
  IonRouterOutlet,
  setupIonicReact,
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
  IonSpinner
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import {
  shieldOutline,
  lockClosedOutline,
  wifiOutline,
  warningOutline
} from 'ionicons/icons';

import { SecurityProvider, useSecurity } from './contexts/SecurityContext';
import { VaultProvider } from './contexts/VaultContext';
import AuthPage from './pages/Auth/AuthPage';
import { LockOverlay } from './components/Auth/LockOverlay';
import ShaderBackground from './components/ui/shader-background';
import { SecurityTermsModal } from './components/Security/SecurityTermsModal';
import { StorageService } from './services/storage';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/* Theme variables */
import './theme/variables.css';

setupIonicReact();

// Lazy Loading de Rotas para Otimização de Carga Inicial e Performance Mobile
const Home = lazy(() => import('./pages/Home'));
const VaultListPage = lazy(() => import('./pages/Vault/VaultListPage').then(m => ({ default: m.VaultListPage })));
const VaultFormPage = lazy(() => import('./pages/Vault/VaultFormPage').then(m => ({ default: m.VaultFormPage })));
const VaultDetailPage = lazy(() => import('./pages/Vault/VaultDetailPage').then(m => ({ default: m.VaultDetailPage })));

const HardeningPage = lazy(() => import('./pages/Hardening/HardeningPage').then(m => ({ default: m.HardeningPage })));
const AnalysisPage = lazy(() => import('./pages/Analysis/AnalysisPage').then(m => ({ default: m.AnalysisPage })));
const EducationPage = lazy(() => import('./pages/Education/EducationPage').then(m => ({ default: m.EducationPage })));
const SettingsPage = lazy(() => import('./pages/Settings/SettingsPage').then(m => ({ default: m.SettingsPage })));

// Novas Páginas (VPN Nativa & Módulo de Vazamento de Dados)
const VpnPage = lazy(() => import('./pages/Vpn/VpnPage').then(m => ({ default: m.VpnPage })));
const BreachPage = lazy(() => import('./pages/Breach/BreachPage').then(m => ({ default: m.BreachPage })));

const LoadingFallback: React.FC = () => (
  <div className="w-full h-full flex flex-col items-center justify-center min-h-[60vh] gap-3">
    <IonSpinner name="crescent" style={{ color: '#00f2fe' }} />
    <span className="text-xs font-bold text-slate-400 tracking-wider">Carregando Módulo Seguro...</span>
  </div>
);

const RouteAwareShaderBackground: React.FC = () => {
  const location = useLocation();
  const isHome = location.pathname === '/home';
  if (isHome) return null;
  return <ShaderBackground />;
};

const AppContent: React.FC = () => {
  const { isLoggedIn, isLocked, activeEmail } = useSecurity();
  const [showTermsModal, setShowTermsModal] = useState<boolean>(false);

  useEffect(() => {
    async function checkTerms() {
      if (isLoggedIn && activeEmail) {
        const status = await StorageService.getSecurityTermsAccepted(activeEmail);
        if (!status.accepted) {
          setShowTermsModal(true);
        }
      }
    }
    checkTerms();
  }, [isLoggedIn, activeEmail]);

  return (
    <IonApp style={{ background: '#070a13' }}>
      {!isLoggedIn ? (
        <AuthPage />
      ) : (
        <VaultProvider>
          <IonReactRouter>
            <RouteAwareShaderBackground />
            <IonTabs>
              <IonRouterOutlet style={{ overflow: 'hidden' }}>
                <Suspense fallback={<LoadingFallback />}>
                  {/* Abas Principais */}
                  <Route exact path="/home" component={Home} />
                  <Route exact path="/vault" component={VaultListPage} />
                  <Route exact path="/vpn" component={VpnPage} />
                  <Route exact path="/breach" component={BreachPage} />

                  {/* Outros Módulos */}
                  <Route exact path="/hardening" component={HardeningPage} />
                  <Route exact path="/analysis" component={AnalysisPage} />
                  <Route exact path="/education" component={EducationPage} />
                  <Route exact path="/settings" component={SettingsPage} />

                  {/* Subpáginas do Cofre */}
                  <Route exact path="/vault/add" component={VaultFormPage} />
                  <Route exact path="/vault/edit/:id" component={VaultFormPage} />
                  <Route exact path="/vault/detail/:id" component={VaultDetailPage} />

                  <Route exact path="/">
                    <Redirect to="/vault" />
                  </Route>
                </Suspense>
              </IonRouterOutlet>

              {/* Tab Bar Customizada Premium */}
              <IonTabBar
                slot="bottom"
                style={{
                  '--background': '#090d1a',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  height: '65px',
                  paddingBottom: '4px',
                }}
              >
                <IonTabButton
                  tab="vault"
                  href="/vault"
                  style={{
                    '--color': 'rgba(255,255,255,0.4)',
                    '--color-selected': '#00f2fe',
                    background: 'transparent',
                  }}
                >
                  <IonIcon icon={lockClosedOutline} style={{ fontSize: '20px' }} />
                  <IonLabel style={{ fontSize: '0.72rem', fontWeight: '700' }}>Cofre</IonLabel>
                </IonTabButton>

                <IonTabButton
                  tab="vpn"
                  href="/vpn"
                  style={{
                    '--color': 'rgba(255,255,255,0.4)',
                    '--color-selected': '#00f2fe',
                    background: 'transparent',
                  }}
                >
                  <IonIcon icon={wifiOutline} style={{ fontSize: '20px' }} />
                  <IonLabel style={{ fontSize: '0.72rem', fontWeight: '700' }}>VPN Nativa</IonLabel>
                </IonTabButton>

                <IonTabButton
                  tab="breach"
                  href="/breach"
                  style={{
                    '--color': 'rgba(255,255,255,0.4)',
                    '--color-selected': '#00f2fe',
                    background: 'transparent',
                  }}
                >
                  <IonIcon icon={warningOutline} style={{ fontSize: '20px' }} />
                  <IonLabel style={{ fontSize: '0.72rem', fontWeight: '700' }}>Vazamentos</IonLabel>
                </IonTabButton>

                <IonTabButton
                  tab="home"
                  href="/home"
                  style={{
                    '--color': 'rgba(255,255,255,0.4)',
                    '--color-selected': '#00f2fe',
                    background: 'transparent',
                  }}
                >
                  <IonIcon icon={shieldOutline} style={{ fontSize: '20px' }} />
                  <IonLabel style={{ fontSize: '0.72rem', fontWeight: '700' }}>Painel Seg</IonLabel>
                </IonTabButton>
              </IonTabBar>
            </IonTabs>
          </IonReactRouter>

          {/* Modal de Aceite dos Termos de Segurança */}
          <SecurityTermsModal
            isOpen={showTermsModal}
            userEmail={activeEmail || ''}
            onAccept={() => setShowTermsModal(false)}
          />
        </VaultProvider>
      )}

      {isLocked && <LockOverlay />}
    </IonApp>
  );
};

const App: React.FC = () => (
  <SecurityProvider>
    <AppContent />
  </SecurityProvider>
);

export default App;
