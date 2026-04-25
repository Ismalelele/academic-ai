import { RefreshCw } from 'lucide-react';

export default function Horario() {
  return (
    <main className="main-content">
      <header>
        <h1>Mi Horario Semanal</h1>
        <button className="btn-primary">Actualizar Horario <RefreshCw size={20} /></button>
      </header>

      <div className="timetable-container">
        <div className="time-column">
            <div className="time-header">HORAS</div>
            <div className="time-slot">08:15 - 08:55</div><div className="time-slot">08:56 - 09:35</div>
            <div className="time-slot">09:45 - 10:25</div><div className="time-slot">10:26 - 11:05</div>
            <div className="time-slot">11:15 - 11:55</div><div className="time-slot">11:56 - 12:35</div>
            <div className="time-slot">12:45 - 13:25</div><div className="time-slot">13:26 - 14:05</div>
            <div className="time-slot">14:15 - 14:55</div><div className="time-slot">14:56 - 15:35</div>
            <div className="time-slot">15:45 - 16:25</div><div className="time-slot">16:26 - 17:05</div>
            <div className="time-slot">17:15 - 17:55</div><div className="time-slot">17:56 - 18:35</div>
            <div className="time-slot">18:40 - 19:20</div><div className="time-slot">19:21 - 20:00</div>
            <div className="time-slot">20:51 - 21:30</div><div className="time-slot">21:40 - 22:20</div>
        </div>

        <div className="days-container">
            <div className="days-header">
                <div>LUNES</div><div>MARTES</div><div>MIÉRCOLES</div><div>JUEVES</div><div>VIERNES</div><div>SÁBADO</div>
            </div>
            <div className="grid-content">
                <div className="day-track"></div>
                <div className="day-track"></div>

                <div className="day-track">
                    <div className="card cultura" style={{ top: '187.5px', height: '75px' }}>Cultura y Valores <br /> <span>Sala 208</span></div>
                    <div className="card tecnologias" style={{ top: '262.5px', height: '112.5px' }}>Tecnologías Humanizadas <br /> <span>Sala 213</span></div>
                    <div className="card ciber" style={{ top: '450px', height: '75px' }}>Ciberseguridad <br /> <span>Sala 207</span></div>
                </div>
                
                <div className="day-track">
                    <div className="card cultura" style={{ top: '187.5px', height: '75px' }}>Cultura y Valores <br /> <span>Sala 404</span></div>
                    <div className="card proy-colab" style={{ top: '337.5px', height: '112.5px' }}>Proy Colab Inn Reg <br /> <span>Sala 207</span></div>
                </div>

                <div className="day-track">
                    <div className="card formulacion" style={{ top: '262.5px', height: '150px' }}>Formulación Proy <br /> <span>Sala 310</span></div>
                    <div className="card competencias" style={{ top: '450px', height: '75px' }}>Int Competencias III <br /> <span>Redes 2</span></div>
                </div>

                <div className="day-track">
                    <div className="card ciber" style={{ top: '0px', height: '75px' }}>Ciberseguridad <br /> <span>Lab 6</span></div>
                    <div className="card procesos" style={{ top: '75px', height: '75px' }}>Gest Proc Neg <br /> <span>Redes 2</span></div>
                    <div className="card procesos" style={{ top: '150px', height: '75px' }}>Gest Proc Neg Lab <br /> <span>Sala 404</span></div>
                    <div className="card proy-noche" style={{ top: '600px', height: '75px' }}>Proy Col Inn Re <br /> <span>Noche</span></div>
                </div>
            </div>
        </div>
      </div>
    </main>
  );
}
