"""Local camera access, adapted from the MIT upstream. No video writer."""


class Camera:
    def __init__(self, source=0):
        import cv2
        self.cam = cv2.VideoCapture(source)
        self.cam.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.cam.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    def isOpened(self):
        return self.cam.isOpened()

    def read(self):
        return self.cam.read()

    def release(self):
        self.cam.release()
