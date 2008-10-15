#!/usr/bin/python
# build_xpi.py -- builds JAR and XPI files for mozilla extensions
# by Chromakode <chromakode@gmail.com>
#
# Based on the functionality of build.sh by Nickolay Ponomarev, Nathan Yergler.

import sys
from os import system, path, curdir, pardir, sep, walk, remove
from shutil import rmtree
import re
import time
from zipfile import ZipFile, ZipInfo, ZIP_STORED, ZIP_DEFLATED

# From Python 2.6: posixpath.py
# Should work on windows too, since we're not going to run into case inconsistencies or UNC paths 
def _relpath(p, start=curdir):
    """Return a relative version of a path"""
    
    if not p:
        raise ValueError("no path specified")

    start_list = path.abspath(start).split(sep)
    path_list = path.abspath(p).split(sep)

    # Work out how much of the filepath is shared by start and path.
    i = len(path.commonprefix([start_list, path_list]))

    rel_list = [pardir] * (len(start_list)-i) + path_list[i:]
    if not rel_list:
        return curdir
    return path.join(*rel_list)
    
# Python <2.6 compatibility
if hasattr(path, "relpath"):
    relpath = path.relpath
else:
    relpath = _relpath

def walk_visible(*args):
    for root, dirs, files in walk(*args):
        # Do not walk hidden ".foo" files
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        
        yield root, dirs, files

def remove_if_exists(p):
    if path.exists(p):
        remove(p)

class XPIBuilder:
    def __init__(self, basepath, config, verbose=False):        
        self.basepath = basepath

        # Config variables
        self.c = config
        self.verbose = verbose

        # Special paths/names
        self.n = {}        
        self.n["jar"] = self.c["app_name"]+".jar"
        self.n["jar_loc"] = "chrome/" + self.n["jar"]
        self.n["xpi"] = self.c["app_name"]+".xpi"
    
    def p(self, p):
        """Return a path relative to the the base path"""
        return path.join(self.basepath, p)
    
    def pn(self, n):
        """Return a path for the named file relative to the base path"""            
        return self.p(self.n[n])
    
    def statusmsg(self, msg):
        if self.verbose:
            print(msg)
    
    def add_file_to_zip(self, p, zip, base=None):
        # Don't ever add the zip file itself
        if path.abspath(p) != path.abspath(zip.filename):
            if base is not None:
                rp = relpath(p, base)
            else:
                rp = p
                
            self.statusmsg("\t\tAdding %s" % rp)
                
            zip.write(p, rp)

    def add_dir_to_zip(self, dir, zip, base=None):
        for root, dirs, files in walk_visible(dir):
            for filename in files:
                # Skip "backup" filenames ending with '~'
                if not filename.endswith("~"):
                    p = path.join(root, filename)
                    self.add_file_to_zip(p, zip, base)
    
    def clean(self):
        """Remove any files from the previous build"""
        self.statusmsg("Cleaning build directory...")
        remove_if_exists(self.pn("jar"))
        remove_if_exists(self.pn("xpi"))
    
    def cleanup(self):
        self.statusmsg("Cleaning up finished build directory...")
        if (self.c["clean_up"]):
            remove_if_exists(self.pn("jar"))
    
    def build(self):
        self.statusmsg("Starting XPI build...")
             
        if "before_cmd" in self.c:
            self.statusmsg("Executing before_cmd...")
            system(self.c["before_cmd"])
        
        self.clean()
        self.build_jar()
        self.build_xpi()
        self.cleanup()
        
        if "after_cmd" in self.c:
            self.statusmsg("Executing after_cmd...")
            system(self.c["after_cmd"])
            
        self.statusmsg("Done.")
            
    def process_chrome_manifest(self):
        self.statusmsg("\tProcessing chrome.manifest file...")
        
        try:
            chrome_manifest_str = open(self.p("chrome.manifest")).read()
        except IOError:
            sys.exit("Error: Unable to locate the chrome.manifest file.")
        
        # Change paths to chrome directories to their locations in the JAR
        # Example: "content myapp content/" -> "content myapp jar:chrome/myapp.jar!content/"
        jarify_re = re.compile(r"(?m)^((content|skin|locale).*\s+)(\S+/)(.*)$", re.MULTILINE)
        jar_chrome_manifest_str = re.sub(jarify_re, r"\1jar:%s!/\3\4" % self.n["jar_loc"], chrome_manifest_str)
        
        return jar_chrome_manifest_str
            
    def build_jar(self):
        self.statusmsg("Creating JAR file %s..." % relpath(self.pn("jar")))
        jarfile = ZipFile(self.pn("jar"), "w", ZIP_STORED)
        
        for chromedir in self.c["chrome_dirs"]:
            self.statusmsg("\tAdding chrome directory \"%s\":" % chromedir)
            self.add_dir_to_zip(self.p(chromedir), jarfile, self.basepath)
                
        jarfile.close()
            
    def build_xpi(self):
        self.statusmsg("Creating XPI file %s..." % relpath(self.pn("xpi")))
        xpifile = ZipFile(self.pn("xpi"), "w", ZIP_DEFLATED)
        
        for rootdir in self.c["root_dirs"]:
            self.statusmsg("\tAdding root directory \"%s\":" % rootdir)
            self.add_dir_to_zip(self.p(rootdir), xpifile, self.basepath)
            
        self.statusmsg("\tAdding root files")
        for rootfile in self.c["root_files"]+["install.rdf"]:
            self.add_file_to_zip(self.p(rootfile), xpifile, self.basepath)
        
        self.statusmsg("\tAdding %s" % self.n["jar"])
        xpifile.write(self.pn("jar"), self.n["jar_loc"])
        
        chrome_manifest_str = self.process_chrome_manifest()
        self.statusmsg("\tAdding chrome.manifest")
        # Add the chrome.manifest to the XPI
        chrome_manifest_zi = ZipInfo("chrome.manifest", time.localtime())
        chrome_manifest_zi.external_attr = 0644<<16
        xpifile.writestr(chrome_manifest_zi, chrome_manifest_str)
        
        xpifile.close()
                
def load_config():
    try:
        from buildxpi_config import config
    except ImportError:
        sys.exit("Error: Unable to import the build configuration data. Please make sure the module build_xpi_config exists and is properly formatted.")

    config.setdefault("clean_up", True)

    return config

def main():
    from optparse import OptionParser
    
    parser = OptionParser()
    parser.add_option("-v", "--verbose",
                      action="store_true", dest="verbose", default=False,
                      help="display verbose status messages")
    parser.add_option("-p", "--path",
                      action="store", dest="path", default=sys.path[0],
                      help="build the XPI sources located at this path")

    (options, args) = parser.parse_args()
    
    # Add the source path to the module path so that we can import the options file.
    if options.path not in sys.path:
        sys.path.append(options.path)
    
    builder = XPIBuilder(options.path, load_config(), options.verbose)
    builder.build()

if __name__ == "__main__":
    main()
