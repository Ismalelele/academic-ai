import { Share2, ShieldCheck, PencilLine, Users } from 'lucide-react';

export default function Herramientas() {
  return (
    <main className="main-content">
      <header>
        <div>
            <h1>Herramientas Sugeridas por la IA</h1>
            <p className="subtitle" style={{ color: 'var(--text-muted)', marginTop: '5px' }}>Recursos optimizados según tus ramos de Nivel VII</p>
        </div>
      </header>

      <div className="dashboard-grid">
        <div className="left-col-tools" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          <section className="todo-card">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}><Share2 size={20} /> Modelado de Procesos (BPMN)</h3>
            <div className="tool-item-box" style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px', marginBottom: '10px' }}>
              <strong>Diagrams.net (Draw.io)</strong>
              <p style={{ marginTop: '5px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Indispensable para <strong>Gest Proc Neg</strong>. Permite exportar en XML, formato que tu IA puede procesar para validar tus flujos.</p>
            </div>
            <div className="tool-item-box" style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px' }}>
              <strong>Bizagi Modeler</strong>
              <p style={{ marginTop: '5px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Para un nivel de detalle más técnico en el diseño de procesos de negocio.</p>
            </div>
          </section>

          <section className="todo-card">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}><ShieldCheck size={20} /> Ciberseguridad e Infraestructura</h3>
            <div className="tool-item-box" style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px', marginBottom: '10px' }}>
              <strong>Anki Flashcards</strong>
              <p style={{ marginTop: '5px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>La IA generará mazos automáticos de protocolos SSL/TLS y vulnerabilidades para que los repases antes del sábado.</p>
            </div>
            <div className="tool-item-box" style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px' }}>
              <strong>Cisco Packet Tracer / GNS3</strong>
              <p style={{ marginTop: '5px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Simulación de redes para tus laboratorios prácticos de este semestre.</p>
            </div>
          </section>
        </div>

        <div className="right-col-tools" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          <section className="todo-card">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}><PencilLine size={20} /> Toma de Apuntes (Markdown)</h3>
            <p className="desc" style={{ marginBottom: '15px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>La IA recomienda <strong>Obsidian</strong>. Al ser archivos .md planos, el motor de búsqueda (RAG) puede leer tus notas y responderte dudas rápido.</p>
            <div className="notes-preview" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <textarea placeholder="Escribe un apunte rápido aquí..." style={{ width: '100%', height: '100px', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', resize: 'none' }}></textarea>
              <button className="btn-primary" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>Sincronizar con IA</button>
            </div>
          </section>

          <section className="todo-card">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}><Users size={20} /> Innovación Colaborativa</h3>
            <div className="tool-item-box" style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px' }}>
              <strong>Miro</strong>
              <p style={{ marginTop: '5px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Ideal para el ramo de <strong>Proy Colab de Inn Reg Avan</strong>. Usa el plugin de exportación para que la IA analice tus mapas mentales.</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
