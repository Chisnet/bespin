Bespin
======

A simpler, more developer friendly web front-end for ElasticSearch.

Tested on both 0.90.10 and 1.3.4, and should hopefully work on any version in between!

Installation
------------

### Installing as a plugin

You can install Bespin as a plugin for ElasticSearch so it is always available on any machine with access to the cluster.

```
sudo elasticsearch/bin/plugin -install chisnet/bespin
```

You can then access Bespin via http://localhost:9200/_plugin/bespin

If this fails then the plugin didn't install properly, this can be solved by changing to the ElasticSearch plugins directory where bespin is installed, usually:

```
/usr/share/elasticsearch/plugins/bespin/_site
```

and running this command with sudo access:

```
sudo cp Chisnet-bespin-*/* . -R && sudo rm -rf Chisnet-bespin-*
```

### Running locally

As Bespin is written in HTML, you can also just checkout the repository locally and run it directly by opening index.html


Usage
-----

Upon opening Bespin, first thing you'll need to do is enter the address, if it differs from the default. Clicking connect will then connect to your cluster.

On subsequent loads Bespin will automatically attempt to connect to the last successful address.

Once connected there are 4 sections available to you:

### Overview

Gives a visual overview of the structure of your indices in one of two layouts, toggleable from the dropdown on the right hand side.

Alias view is useful if you use aliases in your index structure, it groups indices together by their alias, and has on hover highlighting of indices to show any other aliases they're grouped under.

Vertical view gives a more tabular layout, breaking down the index information to the shard level for a more detailed status overview.

### Browser

A straight-foward index browser tool that allows you to inspect the data in your indices at a fairly basic level.

You can initially filter the data by alias or index, and then further narrow down to the data your interested in by filtering to a certain type, or field value.

Results returned are laid out in a table view, with long or complex fields truncated, with an option to expand each one to show the full data as best as possible.

### Raw

An simple interface for sending raw requests to ElasticSearch.

This is useful if you need to manually write and test a complex query, or debug a query.

### Log

A simple text log, focusing on Bespin's interactions with your Elastic Search cluster, allowing for basic debugging in case of a failure, as well as some insight into how the data that powers Bespin is gathered.

Contributing
------------

Bespin is still in fairly active development, and has yet to go through a proper clean-up phase, so until the structure of the project is cemented contributions will probably not be accepted, but reporting of any issues is encouraged. 
