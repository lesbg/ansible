const ScreenShield = imports.ui.screenShield;
const Background = imports.ui.background;
const NotificationsBox = ScreenShield.NotificationsBox;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;
const Util = imports.misc.util;
const Gio = imports.gi.Gio;
const FileQueryInfoFlags = Gio.FileQueryInfoFlags;
const FileType = Gio.FileType;
const Params = imports.misc.params;
const GLib = imports.gi.GLib;

let _setActiveOrig;
let _completeLockScreenOrig;
let _activateFadeOrig;
let _ensureLockScreenOrig;
let _clearLockScreenOrig;
let _loadFileOrig;
let _updateBackgroundsOrig;

if(typeof(String.prototype.strip) === "undefined")
{
    String.prototype.strip = function() 
    {
        return String(this).replace(/^\s+|\s+$/g, '');
    };
}

function _completeLockScreenInjected() {
    this._setActive(false);
    this.emit('lock-screen-shown');
}

function _setActiveInjected(active) {
    active = false;
    this._oldSetActive(active);
}

function _activateFadeInjected(lightbox, time) {
    lightbox.hide();
    Main.layoutManager.panelBox.hide();
    this.activate(true);
}

function _ensureLockScreenInjected() {
    if (this._hasLockScreen)
        return;

    this._lockScreenContentsBox = new St.BoxLayout({ x_align: Clutter.ActorAlign.CENTER,
                                                     y_align: Clutter.ActorAlign.CENTER,
                                                     x_expand: true,
                                                     y_expand: true,
                                                     vertical: true,
                                                     style_class: 'screen-shield-contents-box' });
    this._lockScreenContents.add_actor(this._lockScreenContentsBox);

    this._notificationsBox = new NotificationsBox();
    this._wakeUpScreenId = this._notificationsBox.connect('wake-up-screen', Lang.bind(this, this._wakeUpScreen));
    this._lockScreenContentsBox.add(this._notificationsBox.actor, { x_fill: true,
                                                                    y_fill: true,
                                                                    expand: true });

    this._hasLockScreen = true;
}

function _clearLockScreenInjected() {
    if (this._notificationsBox) {
        this._notificationsBox.disconnect(this._wakeUpScreenId);
        this._notificationsBox.destroy();
        this._notificationsBox = null;
    }
    Main.layoutManager.panelBox.show();

    this._stopArrowAnimation();

    this._lockScreenContentsBox.destroy();

    this._hasLockScreen = false;
}

function screenShield_updateBackgrounds() {
    if (Main.layoutManager.monitors.length > this._bgManagers.length) {
        log("screenshield.js: _updateBackgrounds with more monitors called");
        for (let i = this._bgManagers.length; i < Main.layoutManager.monitors.length; i++)
            this._createBackground(i)
    } else if (Main.layoutManager.monitors.length < this._bgManagers.length) {
        log("screenshield.js: _updateBackgrounds with fewer monitors called");
        for (let i = Main.layoutManager.monitors.length; i < this._bgManagers.length; i++) {
            let widget = this._bgManagers[i].getContainer();
            this._backgroundGroup.remove_child(widget);
            this._bgManagers[i].destroy();
        }
    } else
        log("screenshield.js: _updateBackgrounds with same monitors called");
}

function bgs_getBackground(monitorIndex) {
    if (this.nextSlide != undefined && this.nextSlide) {
        this._backgrounds = [];
        this.nextSlide = false;
    }
    return this.oldGetBackground(monitorIndex);
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function _enumerateDirs(dirlist, path, basepath) {
    let info;
    let filelist = [];
    let newdirlist = [];
    while ((info = dirlist.next_file(null))) {
        if (info.get_file_type() == FileType.DIRECTORY) {
            newdirlist.push(dirlist.get_child(info));
        } else if (info.get_name().toLowerCase().endsWith('jpg') || info.get_name().toLowerCase().endsWith('png')) {
            filelist.push(dirlist.get_child(info).get_path());
            log('Found file: %s'.format(info.get_name()));
        }
    }
    dirlist.close(null);
    if (this._filelist[path.get_path()] == undefined)
        this._filelist[path.get_path()] = [];
    this._filelist[basepath.get_path()].push.apply(this._filelist[basepath.get_path()], filelist);
    for(let i=0; i<newdirlist.length; i++)
        this._enumerateDirsAsync(newdirlist[i], basepath);
}

function _enumerateDirsAsync(path, basepath) {
    let self = this;
    path.enumerate_children_async('standard::name,standard::type', FileQueryInfoFlags.NONE, 0, null, function(object, res) {
        let dirlist = [];
        try {
            dirlist = path.enumerate_children_finish(res);
        } catch (e) {
            log('WARNING: Unable to enumerate %s'.format(path.get_path()));
            dirlist = null;
        }
        if (dirlist != null) {
            self._enumerateDirs(dirlist, path, basepath);
        }
        shuffleArray(self._filelist);
    });
}

function enumerateDirs(path) {
    if (this._filelist == undefined)
        this._filelist = {};

    if (this._filelist[path.get_path()] != undefined)
        return;

    let dirlist = path.enumerate_children('standard::name,standard::type', FileQueryInfoFlags.NONE, null);
    if (dirlist == null) {
        log('WARNING: Unable to enumerate %s'.format(path.get_path()));
    } else {
        this._enumerateDirs(dirlist, path, path);
        shuffleArray(this._filelist[path.get_path()]);
    }
}

function getNextFile(path) {
    if (this._filelist == undefined)
        this._filelist = {};
    if (this._slideIndex == undefined)
        this._slideIndex = 0;

    let filelist = this._filelist[path.get_path()];
    if (filelist == undefined || filelist.length == 0)
        return null;

    this._slideIndex = (this._slideIndex + 1) % filelist.length;
    return Gio.File.new_for_path(filelist[this._slideIndex]);
}

function bg_init(params) {
    params = Params.parse(params, { slideIndex: 0}, true);
    this._slideIndex = params.slideIndex;
    delete params['slideIndex'];
    this._oldInit(params);
}

function _loadSlideshow(file) {
    this._cache.enumerateDirs(file);
    let new_file = this._cache.getNextFile(file);
    log("Setting new picture: %s".format(new_file.get_path()));
    this._loadImage(new_file);
}

function _loadFile(file) {
    if (file.get_basename().endsWith('.xml'))
        this._loadAnimation(file);
    else if (file.query_file_type(FileQueryInfoFlags.NONE, null) == FileType.DIRECTORY)
        this._loadSlideshow(file);
    else
        this._loadImage(file);
}

function bgm_init(params) {
    this._oldInit(params);
    this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 15, Lang.bind(this, function() {
        if (this._backgroundSource == null) {
            return GLib.SOURCE_REMOVE;
        }

        this._backgroundSource.nextSlide = true;
        this._updateBackgroundActor();
        return GLib.SOURCE_CONTINUE;
    }));
}

function bgm_createBackgroundActor() {
    var bg_actor = this._oldCreateBackgroundActor();
    bg_actor.lower_bottom();
    return bg_actor;
}

function init()
{
}

function enable()
{
    log("Enabling disable-dpms@lesbg.com");
    /* ScreenShield */
    ScreenShield.ScreenShield.prototype._oldSetActive =
        ScreenShield.ScreenShield.prototype._setActive;
    ScreenShield.ScreenShield.prototype._setActive =
        _setActiveInjected;
    _completeLockScreenOrig =
        ScreenShield.ScreenShield.prototype._completeLockScreen;
    ScreenShield.ScreenShield.prototype._completeLockScreen =
        _completeLockScreenInjected;
    _activateFadeOrig =
        ScreenShield.ScreenShield.prototype._activateFade;
    ScreenShield.ScreenShield.prototype._activateFade =
        _activateFadeInjected;
    _ensureLockScreenOrig =
        ScreenShield.ScreenShield.prototype._ensureLockScreen;
    ScreenShield.ScreenShield.prototype._ensureLockScreen =
        _ensureLockScreenInjected;
    _clearLockScreenOrig =
        ScreenShield.ScreenShield.prototype._clearLockScreen;
    ScreenShield.ScreenShield.prototype._clearLockScreen =
        _clearLockScreenInjected;

    /* BackgroundCache */
    Background.BackgroundCache.prototype._enumerateDirs = _enumerateDirs;
    Background.BackgroundCache.prototype._enumerateDirsAsync = _enumerateDirsAsync;
    Background.BackgroundCache.prototype.enumerateDirs = enumerateDirs;
    Background.BackgroundCache.prototype.getNextFile = getNextFile;
    
    /* BackgroundSource */
    Background.BackgroundSource.prototype.oldGetBackground =
        Background.BackgroundSource.prototype.getBackground;
    Background.BackgroundSource.prototype.getBackground =
        bgs_getBackground;

    /* Background */
    Background.Background.prototype._oldInit = Background.Background.prototype._init;
    Background.Background.prototype._init = bg_init;
    Background.Background.prototype._loadSlideshow = _loadSlideshow;
    _loadFileOrig = Background.Background.prototype._loadFile;
    Background.Background.prototype._loadFile = _loadFile;

    /* BackgroundManager */
    Background.BackgroundManager.prototype._oldInit = Background.BackgroundManager.prototype._init;
    Background.BackgroundManager.prototype._init = bgm_init;
    Background.BackgroundManager.prototype._oldCreateBackgroundActor =
        Background.BackgroundManager.prototype._createBackgroundActor;
    Background.BackgroundManager.prototype._createBackgroundActor = bgm_createBackgroundActor;

    /* Update backgrounds */
    Main.screenShield._updateBackgrounds();
    _updateBackgroundsOrig =
        ScreenShield.ScreenShield.prototype._updateBackgrounds;
    ScreenShield.ScreenShield.prototype._updateBackgrounds =
        screenShield_updateBackgrounds;
}


function disable()
{
    /* ScreenShield */
    ScreenShield.ScreenShield.prototype._setActive =
        ScreenShield.ScreenShield.prototype._oldSetActiveOrig;
    ScreenShield.ScreenShield.prototype._completeLockScreen =
        _completeLockScreenOrig;
    ScreenShield.ScreenShield.prototype._activateFade =
        _activateFadeOrig;
    ScreenShield.ScreenShield.prototype._ensureLockScreen =
        _ensureLockScreenOrig;
    ScreenShield.ScreenShield.prototype._clearLockScreen =
        _clearLockScreenOrig;
    ScreenShield.ScreenShield.prototype._updateBackgrounds =
        _updateBackgroundsOrig;

    /* BackgroundSource */
    Background.BackgroundSource.prototype.getBackground =
        Background.BackgroundSource.prototype.oldGetBackground;

    /* Background */
    Background.Background.prototype._init =
        Background.Background.prototype._oldInit;
    Background.Background.prototype._loadFile = _loadFileOrig;
 
    /* BackgroundManager */
    Background.BackgroundManager.prototype._init = Background.BackgroundManager.prototype._oldInit;
    Background.BackgroundManager.prototype._createBackgroundActor =
        Background.BackgroundManager.prototype._oldCreateBackgroundActor;

    /* Update backgrounds */
    Main.screenShield._updateBackgrounds();
}
