import bpy
import os
import sys
import argparse

bpy.ops.file.make_paths_relative()

class ArgumentParserForBlender(argparse.ArgumentParser):
    def _get_argv_after_double_dash(self):
        try:
            idx = sys.argv.index("--")
            return sys.argv[idx + 1:]  # the list after "--"
        except ValueError as e:  # "--" not in the list:
            return []

    # overrides superclass
    def parse_args(self):
        return super().parse_args(args=self._get_argv_after_double_dash())


parser = ArgumentParserForBlender()
parser.add_argument("-o", "--output", dest="output", type=str, required=True, help="output file")
parser.add_argument("-t", "--task", dest="task", type=int, required=False, help="Task Id")
parser.add_argument("-f", "--frame", dest="frame", type=int, required=True, help="Frames to render")
parser.add_argument("-r", "--row", dest="row", type=int, required=True, help="Row coordinate")
parser.add_argument("-cl", "--column", dest="column", type=int, required=True, help="Column coordinate")
parser.add_argument('-ca', "--camera", dest="camera", type=str, required=False, help="Camera name")
parser.add_argument('-ci', "--cut-into", dest="cut_into", type=str, required=False, help="Camera name")

parsed = parser.parse_args()


scene = bpy.context.scene
rndr = scene.render

rndr.use_border = True # we only want to render a specific portion of the image
rndr.use_crop_to_border = False # but at the same time we do not want to crop the image to these dimensions (makes it easier to composite, now images can just be stacked ontop of one another)

rndr.filepath = os.path.join(parsed.output, "out")

scene.frame_set(int(parsed.frame))

# set boundaries for render
cut_into = int(parsed.cut_into)
row = int(parsed.row)
column = int(parsed.column)

rndr.border_min_x = (1 / cut_into) * row
rndr.border_max_x = (1 / cut_into) * (row + 1)
rndr.border_min_y = (1 / cut_into) * column
rndr.border_max_y = (1 / cut_into) * (column + 1)

bpy.ops.render.render(write_still = True)

# blender -b file.blend -P renderer.py -noaudio -- "//render" 0 2 0 1
#                                                   path      frame
#                                                               cut into how many?
#                                                                 row
#                                                                   column

try:
    os.remove(os.path.join(parsed.output, "renderdata"))  # let us try to remove the old renderdata
except OSError:
    pass

f = open(os.path.join(parsed.output, "renderdata"), "w")
f.write(
    "{}\n{}".format(rndr.fps, rndr.fps_base))  # fps is the frames per second in a render, fps_base is the multiplier
f.close()