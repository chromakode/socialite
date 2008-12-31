from buildxpi import run_spock
 
config = {
 
    "after": [run_spock(
                       spock_path = "[insert spock location here]",
                       key_dir_path = "[something like .mozilla/mccoy/[...]/",
                       destination_url = "https://addons.reddit.com/socialite/socialite.xpi",
                       input_path = "update.rdf-base",
                       output_path = "update.rdf",
                   )]
 
}
