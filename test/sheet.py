import sys, subprocess, glob, os
from PIL import Image
pdf, out, pages, dpi, cols = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5])
os.system('rm -f /tmp/sh-*.png')
first, last = pages.split('-')
subprocess.run(['pdftoppm','-r',str(dpi),'-f',first,'-l',last,'-png',pdf,'/tmp/sh'],check=True)
files = sorted(glob.glob('/tmp/sh-*.png'))
ims=[Image.open(f).convert('RGB') for f in files]
w,h=ims[0].size; rows=(len(ims)+cols-1)//cols
sheet=Image.new('RGB',(cols*(w+6),rows*(h+6)),(90,90,90))
for i,im in enumerate(ims): sheet.paste(im,((i%cols)*(w+6)+3,(i//cols)*(h+6)+3))
sheet.save(out)
print(out, sheet.size)
