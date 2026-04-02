import { useState } from 'react';
import { server as serverApi } from '../api';
import { useServer } from '../context/ServerContext';
import {
  MessageSquare,
  Sun,
  Cloud,
  CloudLightning,
  Clock,
  Swords,
  Save,
  Star,
  Zap,
  Shield,
  Skull,
  ChevronRight,
} from 'lucide-react';

// Hook pour accéder au serveur courant dans les composants enfants
let _currentServerId = null;
export function setCurrentServerId(id) { _currentServerId = id; }

async function runCmd(command) {
  return serverApi(_currentServerId).command(command);
}

// Composant pour un bouton de commande rapide
function CmdButton({ label, icon: Icon, command, variant = 'ghost', onResult }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await runCmd(command);
      onResult({ ok: true, msg: `✓ ${label}` });
    } catch (err) {
      onResult({ ok: false, msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className={`btn btn-sm btn-${variant}`}
      onClick={handleClick}
      disabled={loading}
    >
      {Icon && <Icon size={14} />}
      {loading ? '...' : label}
    </button>
  );
}

// Composant pour un formulaire de commande avec champs
function CmdForm({ title, icon: Icon, fields, buildCommand, onResult }) {
  const initial = Object.fromEntries(fields.map((f) => [f.key, f.default ?? '']));
  const [values, setValues] = useState(initial);
  const [loading, setLoading] = useState(false);

  const set = (key, val) => setValues((v) => ({ ...v, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cmd = buildCommand(values);
    if (!cmd) return;
    setLoading(true);
    try {
      await runCmd(cmd);
      onResult({ ok: true, msg: `✓ ${title} exécuté` });
    } catch (err) {
      onResult({ ok: false, msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="cmd-form">
      <div className="cmd-form-header">
        {Icon && <Icon size={16} />}
        <span>{title}</span>
      </div>
      <div className="cmd-form-fields">
        {fields.map((f) =>
          f.type === 'select' ? (
            <select
              key={f.key}
              value={values[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
              required={f.required}
            >
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : (
            <input
              key={f.key}
              type={f.type ?? 'text'}
              placeholder={f.placeholder}
              value={values[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
              required={f.required}
              min={f.min}
              max={f.max}
            />
          )
        )}
        <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
          <ChevronRight size={14} />
          {loading ? '...' : 'Exécuter'}
        </button>
      </div>
    </form>
  );
}

// Formulaire spécial pour le titre (nécessite 2 commandes séparées)
function TitleForm({ onResult }) {
  const [title, setTitle] = useState('');
  const [sub, setSub] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      // Le sous-titre doit être envoyé AVANT le titre
      if (sub.trim()) {
        await runCmd(`title @a subtitle {"text":"${sub.trim()}"}`);
      }
      await runCmd(`title @a title {"text":"${title.trim()}"}`);
      onResult({ ok: true, msg: '✓ Titre envoyé' });
    } catch (err) {
      onResult({ ok: false, msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="cmd-form">
      <div className="cmd-form-header">
        <Star size={16} />
        <span>Titre à l'écran</span>
      </div>
      <div className="cmd-form-fields">
        <input
          type="text"
          placeholder="Titre principal"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Sous-titre (optionnel)"
          value={sub}
          onChange={(e) => setSub(e.target.value)}
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
          <ChevronRight size={14} />
          {loading ? '...' : 'Exécuter'}
        </button>
      </div>
    </form>
  );
}

export default function Commands() {
  const { currentServer } = useServer();
  _currentServerId = currentServer?.id;
  const [result, setResult] = useState(null);

  const onResult = (r) => {
    setResult(r);
    setTimeout(() => setResult(null), 4000);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Commandes rapides</h1>
      </div>

      {result && (
        <div className={`alert ${result.ok ? 'alert-success' : 'alert-error'}`}>
          {result.msg}
        </div>
      )}

      {/* ── COMMUNICATION ── */}
      <div className="cmd-section">
        <div className="cmd-section-title">
          <MessageSquare size={16} />
          Communication
        </div>
        <div className="cmd-section-body">
          <CmdForm
            title="Message dans le chat"
            icon={MessageSquare}
            fields={[
              { key: 'msg', placeholder: 'Message à envoyer...', required: true },
            ]}
            buildCommand={({ msg }) => msg ? `say ${msg}` : null}
            onResult={onResult}
          />
          <TitleForm onResult={onResult} />
          <CmdForm
            title="Kick un joueur"
            icon={Skull}
            fields={[
              { key: 'player', placeholder: 'Pseudo du joueur', required: true },
              { key: 'reason', placeholder: 'Raison (optionnel)' },
            ]}
            buildCommand={({ player, reason }) =>
              player ? `kick ${player}${reason ? ' ' + reason : ''}` : null
            }
            onResult={onResult}
          />
        </div>
      </div>

      {/* ── MÉTÉO ── */}
      <div className="cmd-section">
        <div className="cmd-section-title">
          <Cloud size={16} />
          Météo
        </div>
        <div className="cmd-section-body">
          <div className="cmd-buttons-row">
            <CmdButton label="Ensoleillé" icon={Sun} command="weather clear" variant="ghost" onResult={onResult} />
            <CmdButton label="Pluie" icon={Cloud} command="weather rain" variant="ghost" onResult={onResult} />
            <CmdButton label="Orage" icon={CloudLightning} command="weather thunder" variant="ghost" onResult={onResult} />
          </div>
          <CmdForm
            title="Durée météo"
            icon={Clock}
            fields={[
              {
                key: 'type', type: 'select',
                options: [
                  { value: 'clear', label: 'Ensoleillé' },
                  { value: 'rain', label: 'Pluie' },
                  { value: 'thunder', label: 'Orage' },
                ],
              },
              { key: 'duration', placeholder: 'Durée (secondes)', type: 'number', min: 1, max: 1000000, required: true },
            ]}
            buildCommand={({ type, duration }) =>
              duration ? `weather ${type} ${duration}` : null
            }
            onResult={onResult}
          />
        </div>
      </div>

      {/* ── HEURE ── */}
      <div className="cmd-section">
        <div className="cmd-section-title">
          <Clock size={16} />
          Heure
        </div>
        <div className="cmd-section-body">
          <div className="cmd-buttons-row">
            <CmdButton label="Jour" icon={Sun} command="time set day" onResult={onResult} />
            <CmdButton label="Midi" command="time set noon" onResult={onResult} />
            <CmdButton label="Nuit" command="time set night" onResult={onResult} />
            <CmdButton label="Minuit" command="time set midnight" onResult={onResult} />
          </div>
        </div>
      </div>

      {/* ── DIFFICULTÉ ── */}
      <div className="cmd-section">
        <div className="cmd-section-title">
          <Swords size={16} />
          Difficulté
        </div>
        <div className="cmd-section-body">
          <div className="cmd-buttons-row">
            <CmdButton label="Paisible" command="difficulty peaceful" onResult={onResult} />
            <CmdButton label="Facile" command="difficulty easy" onResult={onResult} />
            <CmdButton label="Normal" command="difficulty normal" onResult={onResult} />
            <CmdButton label="Difficile" command="difficulty hard" onResult={onResult} />
          </div>
        </div>
      </div>

      {/* ── JOUEURS ── */}
      <div className="cmd-section">
        <div className="cmd-section-title">
          <Shield size={16} />
          Joueurs
        </div>
        <div className="cmd-section-body">
          <CmdForm
            title="Mode de jeu"
            icon={Shield}
            fields={[
              { key: 'player', placeholder: 'Pseudo (laisser vide = tous)', required: false },
              {
                key: 'mode', type: 'select',
                options: [
                  { value: 'survival', label: 'Survie' },
                  { value: 'creative', label: 'Créatif' },
                  { value: 'adventure', label: 'Aventure' },
                  { value: 'spectator', label: 'Spectateur' },
                ],
              },
            ]}
            buildCommand={({ player, mode }) =>
              `gamemode ${mode} ${player || '@a'}`
            }
            onResult={onResult}
          />
          <CmdForm
            title="Donner de l'XP"
            icon={Star}
            fields={[
              { key: 'player', placeholder: 'Pseudo du joueur', required: true },
              { key: 'amount', placeholder: 'Quantité', type: 'number', min: 1, required: true },
              {
                key: 'unit', type: 'select',
                options: [
                  { value: 'points', label: 'Points XP' },
                  { value: 'levels', label: 'Niveaux' },
                ],
              },
            ]}
            buildCommand={({ player, amount, unit }) =>
              player && amount ? `xp add ${player} ${amount} ${unit}` : null
            }
            onResult={onResult}
          />
          <CmdForm
            title="Téléporter"
            icon={Zap}
            fields={[
              { key: 'player', placeholder: 'Joueur à téléporter', required: true },
              { key: 'target', placeholder: 'Vers (joueur ou x y z)', required: true },
            ]}
            buildCommand={({ player, target }) =>
              player && target ? `tp ${player} ${target}` : null
            }
            onResult={onResult}
          />
          <CmdForm
            title="Donner un objet"
            icon={Star}
            fields={[
              { key: 'player', placeholder: 'Pseudo du joueur', required: true },
              { key: 'item', placeholder: 'minecraft:diamond_sword', required: true },
              { key: 'amount', placeholder: 'Quantité', type: 'number', min: 1, max: 64, default: '1' },
            ]}
            buildCommand={({ player, item, amount }) =>
              player && item ? `give ${player} ${item} ${amount || 1}` : null
            }
            onResult={onResult}
          />
        </div>
      </div>

      {/* ── SERVEUR ── */}
      <div className="cmd-section">
        <div className="cmd-section-title">
          <Save size={16} />
          Serveur
        </div>
        <div className="cmd-section-body">
          <div className="cmd-buttons-row">
            <CmdButton label="Sauvegarder" icon={Save} command="save-all" variant="primary" onResult={onResult} />
            <CmdButton label="Recharger les données" command="reload" variant="ghost" onResult={onResult} />
            <CmdButton label="Lister les joueurs" command="list" variant="ghost" onResult={onResult} />
          </div>
        </div>
      </div>
    </div>
  );
}
