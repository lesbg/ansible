import sys
import time
import platform
import gi
gi.require_version('Gdk', '3.0')
from gi.repository import Gdk
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk
gi.require_version('GVnc', '1.0')
from gi.repository import GVnc
gi.require_version('GtkVnc', '2.0')
from gi.repository import GtkVnc
import configparser
from optparse import OptionParser

def vnc_connected(src, gui):
    print("Connected to server")

def vnc_initialized(src, gui):
    print("Connection initialized")
    gui.reset_ratio()
    gui.frame.remove(gui.builder.get_object("Loading"))
    gui.frame.add(src)
    gui.win.show_all()

def vnc_disconnected(src):
    print("Disconnected from server")
    Gtk.main_quit()

class appgui:
    __is_fullscreen = False

    def get_server(self):
        hostname = platform.node()
        if hostname.lower().startswith("jcc"):
            server = "jcc-teacher"
        else:
            server = "scc251"
        return server

    def __init__(self):
        css = b""".background { background-color: #000; }
                  .foreground { color: #fff; }"""
        style_provider = Gtk.CssProvider()
        style_provider.load_from_data(css)
        Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(), style_provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)

        gladefile="demo-client.glade"
        windowname="MainWindow"
        self.builder = Gtk.Builder()
        self.builder.add_from_file(gladefile)
        dic = { "onDestroy": (self.quit),
                "onFullscreen": (self.fullscreen),
                "onAspectRatio": (self.aspect_ratio),
                "onWindowState": (self.window_event) }
        self.builder.connect_signals(dic)
        self.win = self.builder.get_object("MainWindow")
        self.frame = self.builder.get_object("Frame")
        host = self.get_server()
        port = "5999"
        self.ratio = 1.3
        self.maintain_aspect = True
        self.vnc = GtkVnc.Display()
        self.vnc.realize()
        self.vnc.set_pointer_grab(False)
        self.vnc.set_keyboard_grab(False)
        self.vnc.set_lossy_encoding(True)
        self.vnc.set_scaling(True)
        self.vnc.set_read_only(True)
        self.vnc.set_force_size(False)
        self.vnc.open_host(host, port)
        self.vnc.connect("vnc-connected", vnc_connected, self)
        self.vnc.connect("vnc-initialized", vnc_initialized, self)
        self.vnc.connect("vnc-disconnected", vnc_disconnected)

    def quit(self, window):
        Gtk.main_quit()

    def fullscreen(self, obj):
        if self.__is_fullscreen:
            self.win.unmaximize()
        else:
            self.win.maximize()

    def aspect_ratio(self, obj):
        if self.maintain_aspect:
            self.maintain_aspect = False
            self.win.remove(self.frame)
            self.frame.remove(self.vnc)
            self.win.add(self.vnc)
        else:
            self.maintain_aspect = True
            self.win.remove(self.vnc)
            self.win.add(self.frame)
            self.frame.add(self.vnc)

    def reset_ratio(self):
        frame = self.builder.get_object("Frame")
        try:
            self.ratio = self.vnc.get_width() / self.vnc.get_height()
        except ZeroDivisionError:
            return
        frame.props.ratio = self.ratio

    def window_event(self, widget, ev):
        self.__is_fullscreen = bool(ev.new_window_state & Gdk.WindowState.MAXIMIZED)
        if self.__is_fullscreen:
            self.builder.get_object("FullscreenImage").set_from_icon_name("view-restore", Gtk.IconSize.BUTTON)
        else:
            self.builder.get_object("FullscreenImage").set_from_icon_name("view-fullscreen", Gtk.IconSize.BUTTON)

app=appgui()
Gtk.main()
