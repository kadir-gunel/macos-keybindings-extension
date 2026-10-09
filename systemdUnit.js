import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const SYSTEMD_BUS_NAME = 'org.freedesktop.systemd1';
const SYSTEMD_MANAGER_PATH = '/org/freedesktop/systemd1';
const SYSTEMD_MANAGER_IFACE = 'org.freedesktop.systemd1.Manager';
const SYSTEMD_UNIT_IFACE = 'org.freedesktop.systemd1.Unit';
const PROPERTIES_IFACE = 'org.freedesktop.DBus.Properties';
const JOB_REMOVED = 'JobRemoved';
const MAX_REMEMBERED_JOBS = 16;

/** Control one systemd user unit through the D-Bus API of the user manager. */
export class SystemdUnit {
    constructor(unitName) {
        this._unit = unitName;
        this._connection = Gio.DBus.session;
        this._pending = new Map();
        this._finished = new Map();
        this._signalId = 0;
    }

    async start() {
        await this._queueJob('StartUnit');
    }

    async stop() {
        await this._queueJob('StopUnit');
    }

    async isActive() {
        try {
            const unit = await this._call(SYSTEMD_MANAGER_PATH, SYSTEMD_MANAGER_IFACE, 'GetUnit',
                new GLib.Variant('(s)', [this._unit]), new GLib.VariantType('(o)'));
            const [unitPath] = unit.deepUnpack();
            const active = await this._call(unitPath, PROPERTIES_IFACE, 'Get',
                new GLib.Variant('(ss)', [SYSTEMD_UNIT_IFACE, 'ActiveState']), new GLib.VariantType('(v)'));
            return active.recursiveUnpack()[0] === 'active';
        } catch {
            /* GetUnit fails when the unit does not exist. */
            return false;
        }
    }

    destroy() {
        if (this._signalId !== 0) {
            this._connection.signal_unsubscribe(this._signalId);
            this._signalId = 0;
        }
        for (const {reject} of this._pending.values())
            reject(new Error('The service control stopped'));
        this._pending.clear();
        this._finished.clear();
    }

    async _queueJob(method) {
        this._subscribeToJobs();
        const job = await this._call(SYSTEMD_MANAGER_PATH, SYSTEMD_MANAGER_IFACE, method,
            new GLib.Variant('(ss)', [this._unit, 'replace']), new GLib.VariantType('(o)'));
        await this._awaitJob(job.deepUnpack()[0]);
    }

    /* JobRemoved tells a finished job from a queued one. Without it a caller
       would read the unit state while the job is still running. */
    _subscribeToJobs() {
        if (this._signalId !== 0)
            return;
        this._signalId = this._connection.signal_subscribe(
            null, SYSTEMD_MANAGER_IFACE, JOB_REMOVED, SYSTEMD_MANAGER_PATH, null,
            Gio.DBusSignalFlags.NONE,
            (_connection, _sender, _path, _iface, _signal, params) => this._onJobRemoved(params));
    }

    _onJobRemoved(params) {
        const [, jobPath, , result] = params.deepUnpack();
        const pending = this._pending.get(jobPath);

        if (pending) {
            this._pending.delete(jobPath);
            this._settle(pending, result);
            return;
        }

        /* The signal can arrive before StartUnit returns the job path. */
        this._finished.set(jobPath, result);
        if (this._finished.size > MAX_REMEMBERED_JOBS)
            this._finished.delete(this._finished.keys().next().value);
    }

    _awaitJob(jobPath) {
        if (this._finished.has(jobPath)) {
            const result = this._finished.get(jobPath);
            this._finished.delete(jobPath);
            return new Promise((resolve, reject) => this._settle({resolve, reject}, result));
        }
        return new Promise((resolve, reject) => this._pending.set(jobPath, {resolve, reject}));
    }

    _settle(pending, result) {
        if (result === 'done')
            pending.resolve();
        else
            pending.reject(new Error(`systemd job ${result}`));
    }

    _call(objectPath, interfaceName, method, parameters, replyType) {
        return new Promise((resolve, reject) => {
            this._connection.call(
                SYSTEMD_BUS_NAME, objectPath, interfaceName, method, parameters, replyType,
                Gio.DBusCallFlags.NONE, -1, null,
                (connection, result) => {
                    try {
                        resolve(connection.call_finish(result));
                    } catch (e) {
                        reject(e);
                    }
                });
        });
    }
}
