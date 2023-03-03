import bpy
import os
import sys

# 0 = directory to render to
# 1 = frame to render
# 2 = min x border
# 3 = max x border
# 4 = min y border
# 5 = max y border
# 6 = frame width
# 7 = frame height

def translate(value, leftMin, leftMax, rightMin, rightMax):
    # figure out width
    leftSpan = leftMax - leftMin
    rightSpan = rightMax - rightMin

    # Convert the left range into a 0-1 range (float)
    valueScaled = float(value - leftMin) / float(leftSpan)

    # Convert the 0-1 range into a value in the right range.
    return rightMin + (valueScaled * rightSpan)

argv = sys.argv
argv = argv[argv.index("--") + 1:]

scene = bpy.context.scene
rndr = scene.render

rndr.use_border = True
rndr.use_crop_to_border = False

rndr.filepath = os.path.join(argv[0], "out")

scene.frame_set(int(argv[1]))

# set border (border range is between 0 and 1, we were provided 0-framesize so need to recalculate)
rndr.border_min_x = translate(int(argv[2]), 0, rndr.resolution_x, 0, 1)
rndr.border_max_x = translate(int(argv[3]), 0, rndr.resolution_x, 0, 1)
rndr.border_min_y = translate(int(argv[4]), 0, rndr.resolution_y, 0, 1)
rndr.border_max_y = translate(int(argv[5]), 0, rndr.resolution_y, 0, 1)

bpy.ops.render.render(write_still = True)