import sys
import threading
import requests
from PyQt5.QtWidgets import QApplication, QWidget
from PyQt5.QtCore import Qt, QRect, QTimer
from PyQt5.QtGui import QRegion, QPainter, QPen

class SmoothOverlay(QWidget):
    def __init__(self):
        super().__init__()
        
        self.setWindowFlags(Qt.WindowStaysOnTopHint | Qt.FramelessWindowHint)
        self.setAttribute(Qt.WA_TranslucentBackground)
        
        self.border_width = 5
        self.setMinimumSize(100, 100)
        self.resize(600, 400)
        self.setMouseTracking(True)
        
        self.current_action = None 
        self.start_pos = None
        self.start_geometry = None
        self.last_sent_data = {}

        self.static_timer = QTimer(self)
        self.static_timer.setSingleShot(True)
        self.static_timer.setInterval(300) 
        self.static_timer.timeout.connect(self.send_bounds_to_go)

    def paintEvent(self, event):
        painter = QPainter(self)
        offset = self.border_width // 2
        rect = self.rect().adjusted(offset, offset, -offset - 1, -offset - 1)
        
        painter.setPen(QPen(Qt.red, self.border_width))
        painter.drawRect(rect)

    def resizeEvent(self, event):
        super().resizeEvent(event)
        outer = QRegion(self.rect())
        inner_rect = QRect(
            self.border_width, 
            self.border_width, 
            self.width() - 2 * self.border_width, 
            self.height() - 2 * self.border_width
        )
        self.setMask(outer.subtracted(QRegion(inner_rect)))

    def send_bounds_to_go(self):
        current_data = {
            "x": self.x(),
            "y": self.y(),
            "width": self.width(),
            "height": self.height()
        }

        if current_data != self.last_sent_data:
            self.last_sent_data = current_data
            
            def background_request():
                try:
                    response = requests.post("http://localhost:8080/update-bounds", json=current_data, timeout=1.0)
                    print(f"DEBUG: x={current_data['x']}, y={current_data['y']} | w={current_data['width']}, h={current_data['height']} -> [SUCCESS: {response.status_code}]")
                except requests.exceptions.RequestException as e:
                    print(f"DEBUG: x={current_data['x']}, y={current_data['y']} | w={current_data['width']}, h={current_data['height']} -> [ERROR: Server offline]")

            threading.Thread(target=background_request, daemon=True).start()

    def get_action_region(self, pos):
        x, y = pos.x(), pos.y()
        w, h = self.width(), self.height()
        corner_len = 20 

        if x < corner_len and y < corner_len: return "top_left"
        if x > w - corner_len and y < corner_len: return "top_right"
        if x < corner_len and y > h - corner_len: return "bottom_left"
        if x > w - corner_len and y > h - corner_len: return "bottom_right"
        return "move"

    def update_cursor(self, action):
        if action in ["top_left", "bottom_right"]:
            self.setCursor(Qt.SizeFDiagCursor)
        elif action in ["top_right", "bottom_left"]:
            self.setCursor(Qt.SizeBDiagCursor)
        else:
            self.setCursor(Qt.SizeAllCursor)

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self.current_action = self.get_action_region(event.pos())
            self.start_pos = event.globalPos()
            self.start_geometry = self.geometry()
            self.static_timer.stop()

    def mouseMoveEvent(self, event):
        if event.buttons() == Qt.NoButton:
            self.update_cursor(self.get_action_region(event.pos()))
            return

        if self.current_action and self.start_pos:
            delta = event.globalPos() - self.start_pos
            rect = QRect(self.start_geometry)

            if self.current_action == "move":
                self.move(self.start_geometry.topLeft() + delta)
            else:
                if "left" in self.current_action: rect.setLeft(rect.left() + delta.x())
                if "right" in self.current_action: rect.setRight(rect.right() + delta.x())
                if "top" in self.current_action: rect.setTop(rect.top() + delta.y())
                if "bottom" in self.current_action: rect.setBottom(rect.bottom() + delta.y())

                if rect.width() >= self.minimumWidth() and rect.height() >= self.minimumHeight():
                    self.setGeometry(rect)

            self.static_timer.start()

    def mouseReleaseEvent(self, event):
        self.current_action = None
        self.update_cursor(self.get_action_region(event.pos()))
        
        self.static_timer.stop()
        self.send_bounds_to_go()

if __name__ == '__main__':
    app = QApplication(sys.argv)
    overlay = SmoothOverlay()
    overlay.show()
    sys.exit(app.exec_())