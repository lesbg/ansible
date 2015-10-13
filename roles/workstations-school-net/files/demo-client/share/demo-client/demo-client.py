import sys
import time
import platform
import gtkvnc
import ConfigParser
from optparse import OptionParser

def vnc_connected(src):
    print "Connected to server"

def vnc_initialized(src, window):
    print "Connection initialized"
#    set_title(src, window, False)
    window.show_all()

def vnc_disconnected(src):
    print "Disconnected from server"
    gtk.main_quit()

class appgui:
    def get_server(self):
        hostname = platform.node()
        if hostname.lower().startswith("jcc"):
            server = "jcc-teacher"
        else:
            server = "scc251"
        return server

    def __init__(self):
        gladefile="demo-client.glade"
        windowname="MainWindow"
        self.wTree=gtk.glade.XML (gladefile)

        dic = { "on_MainWindow_destroy" : (gtk.main_quit),
                "on_MenuQuit_activate" : (gtk.main_quit),
                "on_MenuFullScreen_activate" : (self.toggle_fs) }
        self.wTree.signal_autoconnect (dic)
        self.Layout = self.wTree.get_widget("Layout")
        host = self.get_server()
        port = "5999"
        self.vnc = gtkvnc.Display()
        self.Layout.add(self.vnc)
        self.vnc.realize()
        self.vnc.set_pointer_grab(False)
        self.vnc.set_keyboard_grab(False)
        self.vnc.set_lossy_encoding(True)
        self.vnc.set_scaling(True)
        self.vnc.set_read_only(True)
        self.vnc.set_force_size(False)
        self.vnc.open_host(host, port)
        self.vnc.connect("vnc-connected", vnc_connected)
        self.vnc.connect("vnc-initialized", vnc_initialized, self.wTree.get_widget("MainWindow"))
        self.vnc.connect("vnc-disconnected", vnc_disconnected)

        
    def toggle_fs(self):
        pass

#####CALLBACKS
    def key_pressed(self, widget, event):
        pass

try:
    import gtk
    import gtk.glade
except:
    print "You need to install pyGTK or GTKv2 ",
    print "or set your PYTHONPATH correctly."
    print "try: export PYTHONPATH=",
    print "/usr/local/lib/python2.5/site-packages/"
    sys.exit(1)

app=appgui()
gtk.main()
