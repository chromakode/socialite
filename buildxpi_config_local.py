from buildxpi import run_spock

config = {

    "after":       [run_spock(
                       spock_path       = "",
                       key_dir_path     = "",
                       destination_url  = "http://addons.reddit.com/socialite/socialite.xpi",
                       input_path       = "update.rdf-base",
                       output_path      = "update.rdf",
                   )]

}
