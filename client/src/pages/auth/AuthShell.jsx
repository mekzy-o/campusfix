/** Two-column frame for the sign-in and registration pages. */
import { Logo } from '../../components/Layout';
import { MiniRail } from '../../components/StageRail';

const SAMPLE = [
  { ref: 'SR-2026-00051', title: 'Leaking pipe under the bathroom sink', where: 'Hostel B, Room 214', status: 'IN_PROGRESS', note: 'Chinedu Eze is on site' },
  { ref: 'SR-2026-00049', title: 'Projector not displaying', where: 'Lecture Theatre 2', status: 'ASSIGNED', note: 'Assigned to Grace Effiong' },
  { ref: 'SR-2026-00046', title: 'No power in the whole wing', where: 'Faculty of Science Block', status: 'CLOSED', note: 'Fixed in 6 hours, rated 5/5' },
];

export default function AuthShell({ children }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <section className="relative hidden overflow-hidden bg-navy-dark px-12 py-10 text-white lg:flex lg:flex-col">
        <Logo inverted />
        <div className="mt-auto max-w-md">
          <h2 className="text-[2.6rem] leading-[1.05] font-extrabold [font-stretch:80%]">
            Broken on campus? Report it here and follow it until it&rsquo;s fixed.
          </h2>
          <p className="mt-4 text-[#cdd8e3]">
            Faulty power, leaking pipes, damaged furniture, slow Wi-Fi, classroom equipment and hostel repairs.
            One place for students, staff and the Works &amp; Maintenance team.
          </p>
        </div>
        <ul className="mt-10 space-y-2.5" aria-label="Example requests">
          {SAMPLE.map((s) => (
            <li key={s.ref} className="rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="ref-stamp">{s.ref}</span>
                <MiniRail status={s.status} onDark />
              </div>
              <p className="mt-1.5 font-semibold">{s.title}</p>
              <p className="text-sm text-[#9fb3c8]">
                {s.where}. {s.note}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-xs text-[#9fb3c8]">Works &amp; Maintenance Department</p>
      </section>

      <section className="flex min-h-screen flex-col px-5 py-8 sm:px-10 lg:py-10">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto my-auto w-full max-w-md py-8">{children}</div>
      </section>
    </div>
  );
}
