Bespin
======

A simpler, more developer friendly web front-end for ElasticSearch.

Tested on both 0.90.10 and 1.3.4, and should hopefully work on any version in between!

Installation
------------

### Installing as a plugin

You can install Bespin as a plugin for ElasticSearch so it is always available on any machine with access to the cluster; just run the following command from within the ElasticSearch folder.

```
sudo ./bin/plugin -url https://github.com/Chisnet/bespin/releases/download/v1.2.4/bespin-1.2.4.zip -install bespin
```

You can then access Bespin via http://localhost:9200/_plugin/bespin

### Running locally

As Bespin is written in HTML, you can also just checkout the repository locally and run it directly by opening index.html


Usage
-----

Upon opening Bespin, first thing you'll need to do is enter the address, if it differs from the default. Clicking connect will then connect to your cluster.

On subsequent loads Bespin will automatically attempt to connect to the last successful address.

Once connected there are 4 sections available to you:

### Overview

Gives a visual overview of the structure of your indices in one of two layouts, toggleable from the dropdown on the right hand side.

Vertical view is the default view and gives a clean tabular layout, including a break down of the index information to the shard level for a detailed status overview. Vertical view always provides a handy button to view the mappings for each individual index.

Alias view is useful if you use aliases in your index structure, it groups indices together by their alias, and has on hover highlighting of indices to show any other aliases they're grouped under.

### Browser

A straight-foward index browser tool that allows you to inspect the data in your indices at a fairly basic level.

You can initially filter the data by alias or index, and then further narrow down to the data your interested in by filtering to a certain type, or field value.

Results returned are laid out in a table view, with long or complex fields truncated, with an option to expand each one to show the full data as best as possible. There is also a handy "expander" button on the far left of the table for each document to see it's full index data as a JSON representation.

### Raw

An simple interface for sending raw requests to ElasticSearch.

This is useful if you need to manually write and test a complex query, or debug a query.

### Log

A simple text log, focusing on Bespin's interactions with your Elastic Search cluster, allowing for basic debugging in case of a failure, as well as some insight into how the data that powers Bespin is gathered. Complex ElasticSearch requests have an expander button to view the POST data for the query.

Contributing
------------

Bespin is still in fairly active development, and has yet to go through a proper clean-up phase, so until the structure of the project is cemented contributions will probably not be accepted, but reporting of any issues is encouraged. 
